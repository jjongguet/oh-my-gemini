import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { CliToolDefinition } from './types.js';
import {
  createJsonResult,
  readBoolean,
  readNumber,
  readString,
  resolveWorkingDirectory,
  truncateText,
} from './common.js';

interface GitToolFactoryOptions {
  defaultCwd?: string;
}

const execFileAsync = promisify(execFile);

async function runGit(
  cwd: string,
  args: string[],
  options: {
    timeoutMs?: number;
    maxBufferBytes?: number;
  } = {},
): Promise<{ stdout: string; stderr: string }> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxBufferBytes = options.maxBufferBytes ?? 1_000_000;

  try {
    const result = await execFileAsync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      maxBuffer: maxBufferBytes,
      timeout: timeoutMs,
      windowsHide: true,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: string | number;
    };

    const stderr = execError.stderr ?? execError.message ?? 'git command failed';
    throw new Error(stderr.trim() || `git command failed (${String(execError.code ?? 'unknown')})`);
  }
}

export function createGitTools(options: GitToolFactoryOptions = {}): CliToolDefinition[] {
  const defaultCwd = options.defaultCwd ?? process.cwd();

  return [
    {
      category: 'git',
      name: 'omp_git_status',
      description: 'Read git working tree status and branch summary.',
      inputSchema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Optional git repository working directory.' },
          porcelain: { type: 'boolean', description: 'Return porcelain v2 output.' },
          maxBytes: { type: 'number', description: 'Maximum bytes returned in stdout/stderr summary.' },
        },
      },
      async handler(args) {
        const safeArgs = args;
        const cwd = resolveWorkingDirectory(safeArgs, defaultCwd);
        const porcelain = readBoolean(safeArgs, 'porcelain', false);
        const maxBytes = readNumber(safeArgs, 'maxBytes', {
          defaultValue: 1_000_000,
          min: 1,
          max: 5_000_000,
          integer: true,
        });

        const gitArgs = porcelain
          ? ['status', '--porcelain=v2', '--branch']
          : ['status', '--short', '--branch'];

        const result = await runGit(cwd, gitArgs, {
          maxBufferBytes: maxBytes,
        });

        return createJsonResult({
          cwd,
          porcelain,
          stdout: truncateText(result.stdout, maxBytes),
          stderr: truncateText(result.stderr, maxBytes),
        });
      },
    },
    {
      category: 'git',
      name: 'omp_git_diff',
      description: 'Read git diff output for working tree or staged changes.',
      inputSchema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Optional git repository working directory.' },
          target: { type: 'string', description: 'Optional revision/path target.' },
          staged: { type: 'boolean', description: 'Use staged diff (--cached).' },
          maxBytes: { type: 'number', description: 'Maximum bytes returned in stdout/stderr summary.' },
        },
      },
      async handler(args) {
        const safeArgs = args;
        const cwd = resolveWorkingDirectory(safeArgs, defaultCwd);
        const target = readString(safeArgs, 'target');
        const staged = readBoolean(safeArgs, 'staged', false);
        const maxBytes = readNumber(safeArgs, 'maxBytes', {
          defaultValue: 1_000_000,
          min: 1,
          max: 5_000_000,
          integer: true,
        });

        const gitArgs = ['diff'];
        if (staged) {
          gitArgs.push('--cached');
        }
        if (target) {
          gitArgs.push(target);
        }

        const result = await runGit(cwd, gitArgs, {
          maxBufferBytes: maxBytes,
        });

        return createJsonResult({
          cwd,
          staged,
          target,
          stdout: truncateText(result.stdout, maxBytes),
          stderr: truncateText(result.stderr, maxBytes),
        });
      },
    },
    {
      category: 'git',
      name: 'omp_git_log',
      description: 'Read compact git commit history.',
      inputSchema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Optional git repository working directory.' },
          limit: { type: 'number', description: 'Maximum commits returned (default: 20, max: 200).' },
          maxBytes: { type: 'number', description: 'Maximum bytes returned in stdout/stderr summary.' },
        },
      },
      async handler(args) {
        const safeArgs = args;
        const cwd = resolveWorkingDirectory(safeArgs, defaultCwd);
        const limit = readNumber(safeArgs, 'limit', {
          defaultValue: 20,
          min: 1,
          max: 200,
          integer: true,
        });
        const maxBytes = readNumber(safeArgs, 'maxBytes', {
          defaultValue: 1_000_000,
          min: 1,
          max: 5_000_000,
          integer: true,
        });

        const result = await runGit(cwd, ['log', `-n${limit}`, '--oneline', '--decorate'], {
          maxBufferBytes: maxBytes,
        });

        return createJsonResult({
          cwd,
          limit,
          stdout: truncateText(result.stdout, maxBytes),
          stderr: truncateText(result.stderr, maxBytes),
        });
      },
    },
  ];
}
