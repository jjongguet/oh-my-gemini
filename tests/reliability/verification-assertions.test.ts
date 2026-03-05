import { describe, expect, it } from 'vitest';

import {
  assertExpectedSuites,
  assertNoCommandSubstring,
  assertSuiteCommandPrefix,
  type VerifyReport,
} from '../../src/verification/index.js';

function makeReport(commands: Array<{ suite: 'typecheck' | 'smoke'; command: string }>): VerifyReport {
  return {
    ok: false,
    executionMode: 'dry-run',
    suites: commands.map((entry) => ({
      suite: entry.suite,
      command: entry.command,
      status: 'skipped',
      exitCode: 0,
      durationMs: 0,
    })),
  };
}

describe('reliability: verification assertion helpers', () => {
  it('assertExpectedSuites validates exact suite set', () => {
    const report = makeReport([
      { suite: 'typecheck', command: 'npm run typecheck' },
      { suite: 'smoke', command: 'npm run test:smoke' },
    ]);

    const pass = assertExpectedSuites(report, ['typecheck', 'smoke']);
    expect(pass.ok).toBe(true);

    const fail = assertExpectedSuites(report, ['typecheck']);
    expect(fail.ok).toBe(false);
    expect(fail.failures.join('\n')).toMatch(/unexpected suite/i);
  });

  it('assertSuiteCommandPrefix enforces package manager prefix', () => {
    const report = makeReport([
      { suite: 'typecheck', command: 'npm run typecheck' },
      { suite: 'smoke', command: 'pnpm test:smoke' },
    ]);

    const result = assertSuiteCommandPrefix(report, 'npm run ');
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toMatch(/must start with "npm run "/i);
  });

  it('assertNoCommandSubstring blocks forbidden command fragments', () => {
    const report = makeReport([
      { suite: 'typecheck', command: 'npm run typecheck' },
      { suite: 'smoke', command: 'npm run test:smoke' },
    ]);

    const pass = assertNoCommandSubstring(report, 'pnpm');
    expect(pass.ok).toBe(true);

    const fail = assertNoCommandSubstring(
      makeReport([{ suite: 'smoke', command: 'pnpm run test:smoke' }]),
      'pnpm',
    );
    expect(fail.ok).toBe(false);
    expect(fail.failures.join('\n')).toMatch(/must not include "pnpm"/i);
  });
});
