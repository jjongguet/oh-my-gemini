import { spawnSync } from 'node:child_process';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { hasFlag, parseCliArgs } from './arg-utils.js';
import { resolveExtensionPath } from './extension-path.js';

export type LaunchTarget = 'inside-tmux' | 'new-tmux-session';

export interface LaunchCommandContext {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  io: CliIo;
  launchRunner?: (input: LaunchRunnerInput) => Promise<LaunchRunnerResult> | LaunchRunnerResult;
}

export interface LaunchRunnerInput {
  cwd: string;
  env: NodeJS.ProcessEnv;
  extensionPath: string;
  target: LaunchTarget;
  sessionName: string | null;
  geminiArgs: string[];
}

export interface LaunchRunnerResult {
  exitCode: number;
}

function sanitizeSessionToken(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'workspace';
}

export function buildLaunchSessionName(cwd: string, now: number = Date.now()): string {
  const dirToken = sanitizeSessionToken(path.basename(cwd) || 'workspace');
  return `omg-${dirToken}-${now}`.slice(0, 120);
}

export function resolveLaunchTarget(env: NodeJS.ProcessEnv = process.env): LaunchTarget {
  return env.TMUX ? 'inside-tmux' : 'new-tmux-session';
}

export function normalizeLaunchArgs(argv: string[]): string[] {
  const normalized: string[] = [];
  let sawYolo = false;
  let sawSandbox = false;
  let sawMadmax = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';

    if (token === '--madmax') {
      sawMadmax = true;
      continue;
    }

    if (token === '--yolo' || token === '-y') {
      sawYolo = true;
    }

    if (token === '--sandbox' || token?.startsWith('--sandbox=')) {
      sawSandbox = true;
    }

    normalized.push(token);

    if (token === '--sandbox' && index + 1 < argv.length) {
      index += 1;
      normalized.push(argv[index] ?? '');
    }
  }

  if (!sawMadmax) {
    return normalized;
  }

  if (!sawYolo) {
    normalized.unshift('--yolo');
  }

  if (!sawSandbox) {
    normalized.unshift('--sandbox=none');
  }

  return normalized;
}

function defaultLaunchRunner(input: LaunchRunnerInput): LaunchRunnerResult {
  if (input.target === 'inside-tmux') {
    const result = spawnSync('gemini', input.geminiArgs, {
      cwd: input.cwd,
      env: input.env,
      stdio: 'inherit',
    });

    if (result.error) {
      throw result.error;
    }

    return {
      exitCode: result.status ?? 1,
    };
  }

  if (!input.sessionName) {
    throw new Error('tmux session name is required when launching outside tmux');
  }

  const result = spawnSync(
    'tmux',
    ['new-session', '-s', input.sessionName, '-c', input.cwd, 'gemini', ...input.geminiArgs],
    {
      cwd: input.cwd,
      env: input.env,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    exitCode: result.status ?? 1,
  };
}

export async function executeLaunchCommand(
  argv: string[],
  context: LaunchCommandContext,
): Promise<CommandExecutionResult> {
  const env = context.env ?? process.env;

  try {
    const extension = await resolveExtensionPath({
      cwd: context.cwd,
      env,
    });
    const target = resolveLaunchTarget(env);
    const sessionName = target === 'new-tmux-session'
      ? buildLaunchSessionName(context.cwd)
      : null;
    const geminiArgs = ['--extensions', extension.path, ...normalizeLaunchArgs(argv)];

    const result = await (context.launchRunner ?? defaultLaunchRunner)({
      cwd: context.cwd,
      env,
      extensionPath: extension.path,
      target,
      sessionName,
      geminiArgs,
    });

    return { exitCode: result.exitCode };
  } catch (error) {
    context.io.stderr(`Launch failed: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}
