import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { CliToolDefinition } from './types.js';
import {
  createJsonResult,
  readBoolean,
  readNumber,
  readString,
  readStringArray,
  readStringMap,
  resolveWorkingDirectory,
  truncateText,
} from './common.js';

interface ProcessToolFactoryOptions {
  defaultCwd?: string;
  defaultTimeoutMs?: number;
}

const execFileAsync = promisify(execFile);

export function createProcessTools(options: ProcessToolFactoryOptions = {}): CliToolDefinition[] {
  const defaultCwd = options.defaultCwd ?? process.cwd();
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;

  return [
    {
      category: 'process',
      name: 'omp_process_run',
      description: 'Execute a process with explicit args and return stdout/stderr/exit code.',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Executable command to run.' },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Argument list (array or comma-separated string).',
          },
          env: { type: 'object', description: 'Optional string environment overrides.' },
          workingDirectory: { type: 'string', description: 'Optional working directory.' },
          timeoutMs: { type: 'number', description: 'Process timeout in milliseconds (default: 15000).' },
          maxBytes: {
            type: 'number',
            description: 'Maximum UTF-8 bytes returned for stdout/stderr (default: 1000000).',
          },
          allowNonZeroExit: {
            type: 'boolean',
            description: 'When true, non-zero exits return a structured result instead of throwing.',
          },
        },
        required: ['command'],
      },
      async handler(args) {
        const safeArgs = args;
        const cwd = resolveWorkingDirectory(safeArgs, defaultCwd);
        const command = readString(safeArgs, 'command', { required: true }) ?? '';
        const commandArgs = readStringArray(safeArgs, 'args');
        const envOverrides = readStringMap(safeArgs, 'env');
        const timeoutMs = readNumber(safeArgs, 'timeoutMs', {
          defaultValue: defaultTimeoutMs,
          min: 100,
          max: 120_000,
          integer: true,
        });
        const maxBytes = readNumber(safeArgs, 'maxBytes', {
          defaultValue: 1_000_000,
          min: 1,
          max: 5_000_000,
          integer: true,
        });
        const allowNonZeroExit = readBoolean(safeArgs, 'allowNonZeroExit', true);

        try {
          const result = await execFileAsync(command, commandArgs, {
            cwd,
            env: {
              ...process.env,
              ...envOverrides,
            },
            encoding: 'utf8',
            maxBuffer: maxBytes,
            timeout: timeoutMs,
            windowsHide: true,
          });

          return createJsonResult({
            command,
            args: commandArgs,
            cwd,
            timedOut: false,
            exitCode: 0,
            stdout: truncateText(result.stdout, maxBytes),
            stderr: truncateText(result.stderr, maxBytes),
          });
        } catch (error) {
          const execError = error as {
            stdout?: string;
            stderr?: string;
            code?: number | string;
            signal?: NodeJS.Signals;
            killed?: boolean;
            message?: string;
          };

          const exitCode = typeof execError.code === 'number' ? execError.code : null;
          const payload = {
            command,
            args: commandArgs,
            cwd,
            timedOut: execError.killed === true && execError.signal === 'SIGTERM',
            exitCode,
            signal: execError.signal,
            stdout: truncateText(execError.stdout ?? '', maxBytes),
            stderr: truncateText(execError.stderr ?? execError.message ?? '', maxBytes),
          };

          if (allowNonZeroExit) {
            return createJsonResult(payload);
          }

          throw new Error(`process exited with non-zero status: ${JSON.stringify(payload)}`);
        }
      },
    },
  ];
}
