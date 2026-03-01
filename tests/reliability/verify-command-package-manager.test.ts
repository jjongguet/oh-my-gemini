import { describe, expect, test } from 'vitest';

import { executeVerifyCommand } from '../../src/cli/commands/verify.js';
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

describe('reliability: verify command package manager neutrality', () => {
  test('dry-run report uses npm scripts rather than pnpm commands', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(['--dry-run', '--json'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(ioCapture.stdout).toHaveLength(1);
    const [reportRaw] = ioCapture.stdout;
    expect(reportRaw).toBeTypeOf('string');

    const report = JSON.parse(reportRaw ?? '{}') as {
      ok: boolean;
      executionMode: string;
      suites: Array<{ suite: string; command: string }>;
    };

    const commandsBySuite = new Map(
      report.suites.map((suiteResult) => [suiteResult.suite, suiteResult.command]),
    );

    expect(commandsBySuite.get('smoke')).toBe('npm run test:smoke');
    expect(commandsBySuite.get('integration')).toBe('npm run test:integration');
    expect(commandsBySuite.get('reliability')).toBe('npm run test:reliability');
    expect(commandsBySuite.get('reliability')).toBe('npm run test:reliability');

    for (const command of commandsBySuite.values()) {
      expect(command).not.toMatch(/\bpnpm\b/i);
    }

    expect(report.ok).toBe(false);
    expect(report.executionMode).toBe('dry-run');
  });

  test('reliability suite command is npm run test:reliability', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(
      ['--suite', 'reliability', '--dry-run', '--json'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(ioCapture.stdout).toHaveLength(1);
    const [reportRaw] = ioCapture.stdout;
    expect(reportRaw).toBeTypeOf('string');

    const report = JSON.parse(reportRaw ?? '{}') as {
      suites: Array<{ suite: string; command: string }>;
    };

    expect(report.suites).toHaveLength(1);
    expect(report.suites[0]?.suite).toBe('reliability');
    expect(report.suites[0]?.command).toBe('npm run test:reliability');
    expect(report.suites[0]?.command).not.toMatch(/\bpnpm\b/i);
  });

  test('unknown suite exits with usage error code 2', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(
      ['--suite', 'smoke,unknown-suite'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/unknown suite/i);
  });

  test('non dry-run fails when any suite is skipped by custom runner', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(
      ['--suite', 'smoke'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        verifyRunner: async () => ({
          ok: false,
          executionMode: 'executed',
          suites: [
            {
              suite: 'smoke',
              command: 'npm run test:smoke',
              status: 'skipped',
              exitCode: 0,
              durationMs: 0,
            },
          ],
        }),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(ioCapture.stdout.join('\n')).toMatch(/overall: fail/i);
  });
});
