import { describe, expect, test } from 'vitest';

import { runCli } from '../../src/cli/index.js';
import { executeMcpServeCommand } from '../../src/cli/commands/mcp.js';
import type { CliIo } from '../../src/cli/types.js';

function createIoCapture(): {
  io: CliIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout(message: string) {
        stdout.push(message);
      },
      stderr(message: string) {
        stderr.push(message);
      },
    },
    stdout,
    stderr,
  };
}

describe('reliability: mcp serve command', () => {
  test('prints help text', async () => {
    const ioCapture = createIoCapture();

    const result = await executeMcpServeCommand(['--help'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omg mcp serve/i);
  });

  test('rejects unknown options with usage exit code', async () => {
    const ioCapture = createIoCapture();

    const result = await executeMcpServeCommand(['--bogus'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unknown option\(s\): --bogus/i);
  });

  test('dry-run emits MCP surface summary without transport start', async () => {
    const ioCapture = createIoCapture();

    const result = await executeMcpServeCommand(['--dry-run', '--json'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
      exitCode: number;
      details?: {
        dryRun?: boolean;
        toolNames?: string[];
        resourceUris?: string[];
        promptNames?: string[];
      };
    };

    expect(payload.exitCode).toBe(0);
    expect(payload.details?.dryRun).toBe(true);
    expect(payload.details?.toolNames?.length).toBeGreaterThan(0);
    expect(payload.details?.toolNames?.includes('file_read')).toBe(true);
    expect(payload.details?.toolNames?.includes('exec_run')).toBe(true);
    expect(payload.details?.resourceUris?.length).toBeGreaterThan(0);
    expect(payload.details?.promptNames?.length).toBeGreaterThan(0);
  });

  test('runCli dispatches mcp serve via injected runner', async () => {
    const ioCapture = createIoCapture();
    let observed = false;

    const exitCode = await runCli(['mcp', 'serve', '--dry-run', '--json'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      mcpServe: {
        serveRunner: async (input: { dryRun?: boolean; cwd: string }) => {
          observed = true;
          return {
            exitCode: 0,
            message: 'mcp-runner-ok',
            details: {
              dryRun: input.dryRun,
              cwd: input.cwd,
            },
          };
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(observed).toBe(true);

    const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
      message?: string;
      details?: { dryRun?: boolean };
    };

    expect(payload.message).toBe('mcp-runner-ok');
    expect(payload.details?.dryRun).toBe(true);
  });
});
