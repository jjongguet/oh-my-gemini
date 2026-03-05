import { describe, expect, test } from 'vitest';

import { executeVerifyCommand } from '../../src/cli/commands/verify.js';
import type { CliIo } from '../../src/cli/types.js';
import {
  assertExpectedSuites,
  assertNoCommandSubstring,
  assertSuiteCommandPrefix,
  type VerifyReport,
} from '../../src/verification/index.js';

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
  function parseReport(raw: string): VerifyReport {
    return JSON.parse(raw) as VerifyReport;
  }

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

    const report = parseReport(reportRaw ?? '{}');
    const suiteAssertion = assertExpectedSuites(report, [
      'typecheck',
      'smoke',
      'integration',
      'reliability',
    ]);
    expect(suiteAssertion.ok, suiteAssertion.failures.join('\n')).toBe(true);

    const prefixAssertion = assertSuiteCommandPrefix(report, 'npm run ');
    expect(prefixAssertion.ok, prefixAssertion.failures.join('\n')).toBe(true);

    const noPnpmAssertion = assertNoCommandSubstring(report, 'pnpm');
    expect(noPnpmAssertion.ok, noPnpmAssertion.failures.join('\n')).toBe(true);

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

    const report = parseReport(reportRaw ?? '{}');

    expect(report.suites).toHaveLength(1);
    expect(report.suites[0]?.suite).toBe('reliability');
    expect(report.suites[0]?.command).toBe('npm run test:reliability');
    expect(report.suites[0]?.command).not.toMatch(/\bpnpm\b/i);
  });

  test('typecheck suite command is npm run typecheck', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(
      ['--suite', 'typecheck', '--dry-run', '--json'],
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

    const report = parseReport(reportRaw ?? '{}');

    expect(report.suites).toHaveLength(1);
    expect(report.suites[0]?.suite).toBe('typecheck');
    expect(report.suites[0]?.command).toBe('npm run typecheck');
    expect(report.suites[0]?.command).not.toMatch(/\bpnpm\b/i);
  });

  test('tier option maps to tier suite bundles', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(
      ['--tier', 'light', '--dry-run', '--json'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(ioCapture.stdout).toHaveLength(1);
    const report = parseReport(ioCapture.stdout[0] ?? '{}');
    const suites = report.suites.map((suite) => suite.suite);

    expect(suites).toStrictEqual(['typecheck', 'smoke']);
  });

  test('suite and tier cannot be combined', async () => {
    const ioCapture = createIoCapture();

    const result = await executeVerifyCommand(
      ['--suite', 'typecheck', '--tier', 'thorough'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/either --suite or --tier/i);
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
