import { spawn } from 'node:child_process';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface RalphLaunchInput {
  task: string;
  maxIterations: number;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface RalphLaunchOutput {
  exitCode: number;
}

export interface RalphLaunchCommandContext {
  cwd: string;
  io: CliIo;
  runRalph?: (input: RalphLaunchInput) => Promise<RalphLaunchOutput>;
}

function printRalphHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp ralph "<task>"',
    '   or: omp ralph --task "<task>"',
    '   or: omp ralph --max-iterations <N> "<task>"',
    '',
    'Options:',
    '  --task <text>          Task description to run in ralph mode',
    '  --max-iterations <N>   Maximum iterations (default: 10)',
    '  --help                 Show command help',
    '',
    'Examples:',
    '  omp ralph "implement user auth with tests"',
    '  omp ralph --max-iterations 5 "fix all failing tests"',
  ].join('\n'));
}

async function defaultRunRalph(input: RalphLaunchInput): Promise<RalphLaunchOutput> {
  return new Promise<RalphLaunchOutput>((resolve, reject) => {
    const prompt = `ralph: ${input.task}`;
    const child = spawn('gemini', ['-p', prompt], {
      cwd: input.cwd,
      env: {
        ...input.env,
        OMP_MODE: 'ralph',
        OMP_RALPH_MAX_ITERATIONS: String(input.maxIterations),
      },
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1 });
    });
  });
}

export async function executeRalphLaunchCommand(
  argv: string[],
  context: RalphLaunchCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printRalphHelp(context.io);
    return { exitCode: 0 };
  }

  const taskFromFlag = getStringOption(parsed.options, ['task']);
  const task = (taskFromFlag ?? parsed.positionals.join(' ')).trim();

  if (!task) {
    context.io.stderr('Missing task. Provide a task as a positional argument or via --task.');
    context.io.stderr('Run `omp ralph --help` for usage.');
    return { exitCode: 2 };
  }

  const maxIterationsRaw = getStringOption(parsed.options, ['max-iterations']);
  const maxIterations = maxIterationsRaw !== undefined ? parseInt(maxIterationsRaw, 10) : 10;

  if (Number.isNaN(maxIterations) || maxIterations < 1) {
    context.io.stderr('--max-iterations must be a positive integer.');
    return { exitCode: 2 };
  }

  const env = process.env;
  const runner = context.runRalph ?? defaultRunRalph;

  try {
    const result = await runner({ task, maxIterations, cwd: context.cwd, env });
    return { exitCode: result.exitCode };
  } catch (error) {
    context.io.stderr(`Ralph launch failed: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}
