import { runCommand } from '../team/runtime/process-utils.js';

import type { OmgToolDefinition, OmgToolRequestContext } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_LIMIT = 16_000;

export interface ExecToolsOptions {
  defaultTimeoutMs?: number;
  maxTimeoutMs?: number;
  outputLimit?: number;
  allowEnvKeys?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown, key: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array of strings.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`${key}[${index}] must be a string.`);
    }
    return entry;
  });
}

function parseTimeout(value: unknown, options: ExecToolsOptions): number {
  const defaultTimeout = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTimeout = options.maxTimeoutMs ?? MAX_TIMEOUT_MS;

  if (value === undefined) {
    return defaultTimeout;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('timeoutMs must be a positive integer.');
  }

  if (value > maxTimeout) {
    return maxTimeout;
  }

  return value;
}

function truncateOutput(value: string, limit: number): { text: string; truncated: boolean } {
  if (value.length <= limit) {
    return { text: value, truncated: false };
  }

  return {
    text: `${value.slice(0, limit)}\n...<truncated>`,
    truncated: true,
  };
}

function buildEnvironment(
  rawEnv: unknown,
  allowEnvKeys: Set<string>,
): NodeJS.ProcessEnv | undefined {
  if (rawEnv === undefined) {
    return undefined;
  }

  if (!isRecord(rawEnv)) {
    throw new Error('env must be an object of string key/value pairs.');
  }

  const next: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (!allowEnvKeys.has(key)) {
      continue;
    }

    if (typeof value === 'string') {
      next[key] = value;
    }
  }

  return next;
}

function normalizeCwd(rawCwd: unknown, context: OmgToolRequestContext): string {
  if (rawCwd === undefined) {
    return context.cwd;
  }

  if (typeof rawCwd !== 'string' || rawCwd.trim().length === 0) {
    throw new Error('cwd must be a non-empty string when provided.');
  }

  return rawCwd;
}

export function createExecTools(options: ExecToolsOptions = {}): OmgToolDefinition[] {
  const allowEnvKeys = new Set(options.allowEnvKeys ?? ['PATH', 'HOME', 'SHELL', 'TMPDIR', 'CI']);
  const outputLimit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;

  return [
    {
      name: 'exec_run',
      description: 'Run a command with explicit argv, bounded timeout, and bounded output.',
      category: 'exec',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          args: {
            type: 'array',
            items: { type: 'string' },
          },
          cwd: { type: 'string' },
          timeoutMs: { type: 'integer' },
          env: { type: 'object' },
        },
        required: ['command'],
      },
      async handler(args, context) {
        if (!isRecord(args)) {
          throw new Error('Arguments must be an object.');
        }

        const command = args.command;
        if (typeof command !== 'string' || command.trim().length === 0) {
          throw new Error('command is required.');
        }

        const argv = parseStringArray(args.args, 'args');
        const timeoutMs = parseTimeout(args.timeoutMs, options);
        const cwd = normalizeCwd(args.cwd, context);
        const env = buildEnvironment(args.env, allowEnvKeys);

        const result = await runCommand(command, argv, {
          cwd,
          env,
          timeoutMs,
          ignoreNonZero: true,
        });

        const stdout = truncateOutput(result.stdout, outputLimit);
        const stderr = truncateOutput(result.stderr, outputLimit);
        const isError = typeof result.code === 'number' ? result.code !== 0 : true;

        return {
          text: JSON.stringify(
            {
              command,
              args: argv,
              cwd,
              timeoutMs,
              code: result.code,
              stdout: stdout.text,
              stderr: stderr.text,
              stdoutTruncated: stdout.truncated,
              stderrTruncated: stderr.truncated,
            },
            null,
            2,
          ),
          isError,
        };
      },
    },
  ];
}
