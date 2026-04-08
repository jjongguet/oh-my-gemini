import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface AutoresearchInput {
  mission: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface AutoresearchOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AutoresearchCommandContext {
  cwd: string;
  io: CliIo;
  runAutoresearch?: (input: AutoresearchInput) => Promise<AutoresearchOutput>;
  now?: () => Date;
}

function printAutoresearchHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp autoresearch "<mission>"',
    '   or: omp autoresearch --mission "<mission>"',
    '',
    'Options:',
    '  --mission <text>   Research mission or question',
    '  --help             Show command help',
    '',
    'Examples:',
    '  omp autoresearch "compare auth libraries"',
    '  omp autoresearch --mission "what logging do we have"',
  ].join('\n'));
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'research';
}

async function defaultRunAutoresearch(input: AutoresearchInput): Promise<AutoresearchOutput> {
  return new Promise<AutoresearchOutput>((resolve, reject) => {
    const prompt = `$research ${input.mission}`;
    const child = spawn('gemini', ['-p', prompt], {
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
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export async function executeAutoresearchCommand(
  argv: string[],
  context: AutoresearchCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printAutoresearchHelp(context.io);
    return { exitCode: 0 };
  }

  const missionFromFlag = getStringOption(parsed.options, ['mission']);
  const mission = (missionFromFlag ?? parsed.positionals.join(' ')).trim();

  if (!mission) {
    context.io.stderr('Missing mission. Provide a mission as a positional argument or via --mission.');
    context.io.stderr('Run `omp autoresearch --help` for usage.');
    return { exitCode: 2 };
  }

  const env = process.env;
  const runner = context.runAutoresearch ?? defaultRunAutoresearch;

  let result: AutoresearchOutput;
  try {
    result = await runner({ mission, cwd: context.cwd, env });
  } catch (error) {
    context.io.stderr(`Autoresearch failed: ${(error as Error).message}`);
    return { exitCode: 1 };
  }

  const now = context.now?.() ?? new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const slug = slugify(mission);
  const artifactDir = path.join(context.cwd, '.omp', 'artifacts', 'autoresearch');

  try {
    await fs.mkdir(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, `${slug}-${timestamp}.md`);
    const artifactRelativePath = path.relative(context.cwd, artifactPath) || artifactPath;

    const artifactLines = [
      '# omp autoresearch',
      '',
      `- Mission: ${mission}`,
      `- Completed: ${now.toISOString()}`,
      '',
      '## Output',
      '',
      result.stdout.trim() || '_No output returned._',
      result.stderr.trim()
        ? ['', '## Stderr', '', '```text', result.stderr.trim(), '```'].join('\n')
        : undefined,
      '',
    ].filter((value): value is string => value !== undefined);

    await fs.writeFile(artifactPath, `${artifactLines.join('\n')}\n`, 'utf8');

    context.io.stdout(`Autoresearch completed.`);
    context.io.stdout(`Artifact: ${artifactRelativePath}`);
  } catch (error) {
    context.io.stderr(`Failed to save artifact: ${(error as Error).message}`);
  }

  if (result.stdout.trim()) {
    context.io.stdout('');
    context.io.stdout(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    context.io.stderr(result.stderr.trim());
  }

  return { exitCode: result.exitCode === 0 ? 0 : 1 };
}
