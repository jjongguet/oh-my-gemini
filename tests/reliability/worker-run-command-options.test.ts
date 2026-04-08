import { describe, expect, test } from 'vitest';

import { executeWorkerRunCommand } from '../../src/cli/commands/worker-run.js';
import type { CliIo } from '../../src/cli/types.js';

function createIoCapture(): { io: CliIo; stdout: string[]; stderr: string[] } {
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

describe('reliability: worker run command options', () => {
  test('prints help output', async () => {
    const ioCapture = createIoCapture();

    const result = await executeWorkerRunCommand(['--help'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(ioCapture.stdout.join('\n')).toContain('Usage: omp worker run --team <name> --worker <name>');
  });

  test('rejects unknown options', async () => {
    const ioCapture = createIoCapture();

    const result = await executeWorkerRunCommand(['--json'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unknown option\(s\): --json/i);
    expect(ioCapture.stdout.join('\n')).toContain('Usage: omp worker run');
  });

  test('rejects unexpected positional arguments', async () => {
    const ioCapture = createIoCapture();

    const result = await executeWorkerRunCommand(['extra'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unexpected positional arguments: extra/i);
    expect(ioCapture.stdout.join('\n')).toContain('Usage: omp worker run');
  });
});
