import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { recordSession, recordTokenUsage } from '../../state/index.js';
import { detectGeminiRateLimitFromOutput } from './wait.js';
import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

export interface AskCommandContext {
  cwd: string;
  io: CliIo;
  env?: NodeJS.ProcessEnv;
  runAskPrompt?: (input: AskPromptRunnerInput) => Promise<AskPromptRunnerOutput>;
  now?: () => Date;
  createSessionId?: () => string;
}

export interface AskPromptRunnerInput {
  provider: 'gemini';
  prompt: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface AskPromptRunnerOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ParsedAskRequest {
  provider: 'gemini';
  prompt: string;
  agentPromptRole?: string;
  json: boolean;
}

function printAskHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg ask gemini <prompt>',
    '   or: omg ask gemini --prompt "<prompt>"',
    '   or: omg ask gemini --agent-prompt <role> --prompt "<prompt>"',
    '',
    'Options:',
    '  --prompt <text>        Explicit prompt text',
    '  --agent-prompt <role>  Prefix the prompt with a role framing block',
    '  --json                 Print machine-readable output',
    '  --help                 Show command help',
  ].join('\n'));
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'prompt';
}

function buildAgentPrompt(role: string, prompt: string): string {
  return [
    `Adopt the ${role.trim()} role for this answer.`,
    'Return a direct, concrete answer and include actionable guidance.',
    '',
    prompt,
  ].join('\n');
}

function parseAskRequest(argv: string[]): ParsedAskRequest {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    throw new Error('__ASK_HELP__');
  }

  const unknown = findUnknownOptions(parsed.options, ['prompt', 'agent-prompt', 'json', 'help', 'h']);
  if (unknown.length > 0) {
    throw new Error(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`);
  }

  const [providerRaw, ...promptPositionals] = parsed.positionals;
  if (providerRaw !== 'gemini') {
    throw new Error(`Invalid provider "${providerRaw ?? ''}". Expected: gemini.`);
  }

  const promptFromFlag = getStringOption(parsed.options, ['prompt']);
  const prompt = (promptFromFlag ?? promptPositionals.join(' ')).trim();
  if (!prompt) {
    throw new Error('Missing prompt text.');
  }

  return {
    provider: 'gemini',
    prompt,
    agentPromptRole: getStringOption(parsed.options, ['agent-prompt']),
    json: hasFlag(parsed.options, ['json']),
  };
}

async function defaultRunAskPrompt(input: AskPromptRunnerInput): Promise<AskPromptRunnerOutput> {
  return new Promise<AskPromptRunnerOutput>((resolve, reject) => {
    const child = spawn('gemini', ['-p', input.prompt], {
      cwd: input.cwd,
      env: input.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export async function executeAskCommand(
  argv: string[],
  context: AskCommandContext,
): Promise<CommandExecutionResult> {
  const env = context.env ?? process.env;

  let request: ParsedAskRequest;
  try {
    request = parseAskRequest(argv);
  } catch (error) {
    if ((error as Error).message === '__ASK_HELP__') {
      printAskHelp(context.io);
      return { exitCode: 0 };
    }

    context.io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const now = context.now?.() ?? new Date();
  const sessionId = context.createSessionId?.() ?? `ask-${randomUUID()}`;
  const startedAt = now.toISOString();
  const prompt = request.agentPromptRole
    ? buildAgentPrompt(request.agentPromptRole, request.prompt)
    : request.prompt;

  const runner = context.runAskPrompt ?? defaultRunAskPrompt;
  const result = await runner({
    provider: request.provider,
    prompt,
    cwd: context.cwd,
    env,
  });

  const completedAt = (context.now?.() ?? new Date()).toISOString();
  const artifactDir = path.join(context.cwd, '.omg', 'artifacts', 'ask');
  await fs.mkdir(artifactDir, { recursive: true });
  const artifactBase = `${request.provider}-${slugify(request.prompt)}-${completedAt.replace(/[:.]/g, '-')}`;
  const artifactPath = path.join(artifactDir, `${artifactBase}.md`);
  const artifactRelativePath = path.relative(context.cwd, artifactPath) || artifactPath;
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const rateLimited = detectGeminiRateLimitFromOutput(combinedOutput);

  const artifactLines = [
    `# omg ask ${request.provider}`,
    '',
    `- Session: ${sessionId}`,
    `- Started: ${startedAt}`,
    `- Completed: ${completedAt}`,
    request.agentPromptRole ? `- Agent prompt: ${request.agentPromptRole}` : undefined,
    `- Rate limited: ${rateLimited ? 'yes' : 'no'}`,
    '',
    '## Prompt',
    '',
    '```text',
    prompt,
    '```',
    '',
    '## Output',
    '',
    result.stdout.trim() || '_No stdout returned._',
    result.stderr.trim()
      ? ['', '## Stderr', '', '```text', result.stderr.trim(), '```'].join('\n')
      : undefined,
    '',
  ].filter((value): value is string => value !== undefined);

  await fs.writeFile(artifactPath, `${artifactLines.join('\n')}\n`, 'utf8');

  const promptChars = prompt.length;
  const responseChars = result.stdout.length;
  const promptTokens = Math.max(1, Math.ceil(promptChars / 4));
  const responseTokens = Math.max(0, Math.ceil(responseChars / 4));
  const totalTokens = promptTokens + responseTokens;

  await recordTokenUsage(context.cwd, {
    sessionId,
    command: 'ask',
    provider: request.provider,
    promptTextLength: promptChars,
    responseTextLength: responseChars,
    promptTokens,
    responseTokens,
    totalTokens,
    estimatedCostUsd: 0,
    startedAt,
    completedAt,
    metadata: request.agentPromptRole ? { agentPromptRole: request.agentPromptRole } : undefined,
  });

  await recordSession(context.cwd, {
    id: sessionId,
    command: 'ask',
    cwd: context.cwd,
    status: result.exitCode === 0 ? 'completed' : rateLimited ? 'blocked' : 'failed',
    startedAt,
    completedAt,
    provider: request.provider,
    summary: result.exitCode === 0
      ? 'ask completed'
      : rateLimited
        ? 'ask blocked by Gemini rate limit'
        : 'ask failed',
    artifactPath: artifactRelativePath,
    rateLimited,
    metadata: request.agentPromptRole ? { agentPromptRole: request.agentPromptRole } : undefined,
  });

  if (request.json) {
    context.io.stdout(JSON.stringify({
      ok: result.exitCode === 0,
      provider: request.provider,
      sessionId,
      artifactPath: artifactRelativePath,
      stdout: result.stdout,
      stderr: result.stderr,
      rateLimited,
      tokens: {
        prompt: promptTokens,
        response: responseTokens,
        total: totalTokens,
      },
    }, null, 2));
  } else {
    context.io.stdout(`Ask completed via ${request.provider}.`);
    context.io.stdout(`Artifact: ${artifactRelativePath}`);
    if (rateLimited) {
      context.io.stdout('Gemini output indicates a rate limit condition. Run `omg wait` for status.');
    }
    if (result.stdout.trim()) {
      context.io.stdout('');
      context.io.stdout(result.stdout.trim());
    }
    if (result.stderr.trim()) {
      context.io.stderr(result.stderr.trim());
    }
  }

  return { exitCode: result.exitCode === 0 ? 0 : 1 };
}
