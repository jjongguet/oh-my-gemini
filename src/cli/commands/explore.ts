import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

export interface ExploreInput {
  prompt: string;
  cwd: string;
}

export interface ExploreOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExploreCommandContext {
  cwd: string;
  io: CliIo;
  runExplore?: (input: ExploreInput) => Promise<ExploreOutput>;
  now?: () => Date;
}

function printExploreHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp explore <prompt>',
    '   or: omp explore --prompt "<prompt>"',
    '',
    'Read-only codebase exploration via Gemini CLI.',
    '',
    'Options:',
    '  --prompt <text>   Explicit prompt text',
    '  --help, -h        Show command help',
  ].join('\n'));
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'explore';
}

function buildExplorationPrompt(userPrompt: string): string {
  return [
    'You are in read-only exploration mode. Do not make changes. Investigate:',
    '',
    userPrompt,
  ].join('\n');
}

async function defaultRunExplore(input: ExploreInput): Promise<ExploreOutput> {
  return new Promise<ExploreOutput>((resolve, reject) => {
    const child = spawn('gemini', ['-p', input.prompt], {
      cwd: input.cwd,
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

export async function executeExploreCommand(
  argv: string[],
  context: ExploreCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printExploreHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['prompt', 'help', 'h']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const promptFromFlag = getStringOption(parsed.options, ['prompt']);
  const userPrompt = (promptFromFlag ?? parsed.positionals.join(' ')).trim();

  if (!userPrompt) {
    context.io.stderr('Missing prompt text. Usage: omp explore <prompt>');
    return { exitCode: 2 };
  }

  const framedPrompt = buildExplorationPrompt(userPrompt);
  const now = context.now?.() ?? new Date();
  const completedAtLabel = now.toISOString().replace(/[:.]/g, '-');

  const runner = context.runExplore ?? defaultRunExplore;
  const result = await runner({
    prompt: framedPrompt,
    cwd: context.cwd,
  });

  const artifactDir = path.join(context.cwd, '.omp', 'artifacts', 'explore');
  await fs.mkdir(artifactDir, { recursive: true });

  const artifactBase = `${slugify(userPrompt)}-${completedAtLabel}`;
  const artifactPath = path.join(artifactDir, `${artifactBase}.md`);
  const artifactRelativePath = path.relative(context.cwd, artifactPath) || artifactPath;

  const artifactLines = [
    '# omp explore',
    '',
    `- Started: ${now.toISOString()}`,
    '',
    '## Prompt',
    '',
    '```text',
    userPrompt,
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

  context.io.stdout(`Explore completed.`);
  context.io.stdout(`Artifact: ${artifactRelativePath}`);

  if (result.stdout.trim()) {
    context.io.stdout('');
    context.io.stdout(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    context.io.stderr(result.stderr.trim());
  }

  return { exitCode: result.exitCode === 0 ? 0 : 1 };
}
