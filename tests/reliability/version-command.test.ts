import { describe, expect, test } from 'vitest';

import { executeVersionCommand } from '../../src/cli/commands/version.js';
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

describe('reliability: version command', () => {
  test('prints human-readable version output', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVersionCommand([], {
      cwd: process.cwd(),
      io: ioCapture.io,
      resolveOmgVersion: async () => '0.4.0',
      probeVersion: async (command) => {
        if (command === 'node') {
          return 'v25.1.0';
        }
        if (command === 'tmux') {
          return 'tmux 3.4';
        }
        if (command === 'gemini') {
          return 'gemini-cli 1.5.0';
        }
        return null;
      },
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(ioCapture.stdout).toHaveLength(1);
    expect(ioCapture.stdout[0]).toBe([
      'oh-my-gemini v0.4.0',
      '  node:    v25.1.0',
      '  tmux:    3.4',
      '  gemini:  1.5.0',
    ].join('\n'));
  });

  test('prints JSON output with --json', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVersionCommand(['--json'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      resolveOmgVersion: async () => '0.4.0',
      probeVersion: async (command) => {
        if (command === 'node') {
          return 'v25.1.0';
        }
        if (command === 'tmux') {
          return 'tmux 3.4';
        }
        if (command === 'gemini') {
          return '1.5.0';
        }
        return null;
      },
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(ioCapture.stdout).toHaveLength(1);

    const payload = JSON.parse(ioCapture.stdout[0] ?? '{}') as {
      name?: string;
      version?: string;
      node?: string;
      tmux?: string;
      gemini?: string;
    };

    expect(payload).toStrictEqual({
      name: 'oh-my-gemini',
      version: '0.4.0',
      node: 'v25.1.0',
      tmux: '3.4',
      gemini: '1.5.0',
    });
  });

  test('returns usage error on unknown options', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVersionCommand(['--wat'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      resolveOmgVersion: async () => '0.4.0',
      probeVersion: async () => null,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr[0]).toContain('Unknown option(s): --wat');
    expect(ioCapture.stdout[0]).toContain('Usage: omg version');
  });
});
