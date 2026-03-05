import { describe, expect, test } from 'vitest';

import { runCli } from '../../src/cli/index.js';
import type { CliIo } from '../../src/cli/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

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

describe('reliability: cli prd dispatch', () => {
  test('runCli dispatches prd help', async () => {
    const ioCapture = createIoCapture();
    const exitCode = await runCli(['prd', '--help'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omg prd/i);
  });

  test('runCli dispatches prd init/status flow', async () => {
    const tempRoot = createTempDir('omg-cli-prd-dispatch-');
    const ioCapture = createIoCapture();

    try {
      const initExitCode = await runCli(
        ['prd', 'init', '--task', 'CLI dispatch integration', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );
      expect(initExitCode).toBe(0);

      ioCapture.stdout.length = 0;
      const statusExitCode = await runCli(['prd', 'status', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });
      expect(statusExitCode).toBe(0);

      const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
        ok?: boolean;
        status?: { total?: number };
      };
      expect(payload.ok).toBe(true);
      expect(payload.status?.total).toBe(1);
    } finally {
      removeDir(tempRoot);
    }
  });
});
