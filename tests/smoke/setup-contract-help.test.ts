import { describe, expect, test } from 'vitest';

import { executeSetupCommand } from '../../src/cli/commands/setup.js';
import type { CliIo } from '../../src/cli/types.js';
import { repoRoot, runOmg } from '../utils/runtime.js';

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

describe('smoke: install-to-setup help contract', () => {
  test('global help states the post-install setup contract', () => {
    const result = runOmg(['--help'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout).toContain('After npm install -g oh-my-gemini-sisyphus, run setup to apply local files');
    expect(result.stdout).toContain('oh-my-gemini setup --scope project');
  });

  test('setup help states both setup entrypoints', () => {
    const result = runOmg(['setup', '--help'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout).toContain('After npm install -g oh-my-gemini-sisyphus, run setup to apply local files');
    expect(result.stdout).toContain('omg setup ... / oh-my-gemini setup ...');
  });

  test('rejects unknown options with exit code 2', async () => {
    const ioCapture = createIoCapture();

    const result = await executeSetupCommand(['--bad'], {
      cwd: repoRoot,
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toContain('--bad');
  });
});
