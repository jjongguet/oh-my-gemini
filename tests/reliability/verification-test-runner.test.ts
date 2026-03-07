import { describe, expect, it } from 'vitest';

import {
  formatVerifyReport,
  parseVerificationTier,
  parseVerifySuites,
  runVerificationSuites,
  suitesForTier,
  type VerifyCommandExecutor,
} from '../../src/verification/index.js';

describe('reliability: verification test runner', () => {
  it('maps verification tiers to expected suite bundles', () => {
    expect(suitesForTier('LIGHT')).toStrictEqual(['typecheck', 'smoke']);
    expect(suitesForTier('STANDARD')).toStrictEqual(['typecheck', 'smoke', 'integration']);
    expect(suitesForTier('THOROUGH')).toStrictEqual([
      'typecheck',
      'smoke',
      'integration',
      'reliability',
    ]);
  });

  it('parses tier aliases case-insensitively', () => {
    expect(parseVerificationTier('light')).toBe('LIGHT');
    expect(parseVerificationTier('Standard')).toBe('STANDARD');
    expect(parseVerificationTier('THOROUGH')).toBe('THOROUGH');
    expect(parseVerificationTier(undefined)).toBeUndefined();
    expect(() => parseVerificationTier('invalid-tier')).toThrow(/Unknown tier/i);
  });

  it('parses suites with deduplication and validation', () => {
    expect(parseVerifySuites('smoke,smoke,typecheck')).toStrictEqual(['smoke', 'typecheck']);
    expect(parseVerifySuites(undefined)).toStrictEqual([
      'typecheck',
      'smoke',
      'integration',
      'reliability',
    ]);
    expect(() => parseVerifySuites('unknown')).toThrow(/Unknown suite/i);
  });

  it('supports dry-run mode without executing commands', async () => {
    let invoked = false;
    const commandExecutor: VerifyCommandExecutor = async () => {
      invoked = true;
      return { exitCode: 0, durationMs: 1 };
    };

    const report = await runVerificationSuites(
      {
        suites: ['typecheck', 'smoke'],
        dryRun: true,
        cwd: process.cwd(),
      },
      commandExecutor,
    );

    expect(invoked).toBe(false);
    expect(report.executionMode).toBe('dry-run');
    expect(report.ok).toBe(false);
    expect(report.suites.map((suite) => suite.status)).toStrictEqual(['skipped', 'skipped']);
  });

  it('marks report as failed when any suite exits non-zero', async () => {
    const commandExecutor: VerifyCommandExecutor = async (command) => {
      if (command.includes('integration')) {
        return { exitCode: 1, durationMs: 10 };
      }
      return { exitCode: 0, durationMs: 10 };
    };

    const report = await runVerificationSuites(
      {
        suites: ['typecheck', 'integration'],
        dryRun: false,
        cwd: process.cwd(),
      },
      commandExecutor,
    );

    expect(report.executionMode).toBe('executed');
    expect(report.ok).toBe(false);
    expect(report.suites[0]?.status).toBe('passed');
    expect(report.suites[1]?.status).toBe('failed');
  });

  it('formats report text with overall verdict', () => {
    const text = formatVerifyReport({
      ok: true,
      executionMode: 'executed',
      suites: [
        {
          suite: 'typecheck',
          command: 'npm run typecheck',
          status: 'passed',
          exitCode: 0,
          durationMs: 12,
        },
      ],
    });

    expect(text).toContain('Verify report');
    expect(text).toContain('[PASSED] typecheck');
    expect(text).toContain('Overall: pass');
  });
});
