import { spawn } from 'node:child_process';

import { DEFAULT_VERIFY_SUITES } from '../constants.js';
import type { VerificationTier } from './tier-selector.js';

export type VerifySuite = 'typecheck' | 'smoke' | 'integration' | 'reliability';
export type VerifySuiteStatus = 'passed' | 'failed' | 'skipped';

export interface VerifySuiteResult {
  suite: VerifySuite;
  command: string;
  status: VerifySuiteStatus;
  exitCode: number;
  durationMs: number;
}

export interface VerifyReport {
  ok: boolean;
  executionMode: 'executed' | 'dry-run';
  suites: VerifySuiteResult[];
}

export interface VerifyRunnerInput {
  suites: VerifySuite[];
  dryRun: boolean;
  cwd: string;
}

export interface CommandExecutionResult {
  exitCode: number;
  durationMs: number;
}

export type VerifyCommandExecutor = (
  command: string,
  cwd: string,
) => Promise<CommandExecutionResult>;

export const VERIFY_COMMANDS: Record<VerifySuite, string> = {
  typecheck: 'npm run typecheck',
  smoke: 'npm run test:smoke',
  integration: 'npm run test:integration',
  reliability: 'npm run test:reliability',
};

const VERIFY_SUITES_BY_TIER: Record<VerificationTier, VerifySuite[]> = {
  LIGHT: ['typecheck', 'smoke'],
  STANDARD: ['typecheck', 'smoke', 'integration'],
  THOROUGH: [...DEFAULT_VERIFY_SUITES],
};

export function isVerifySuite(value: string): value is VerifySuite {
  return value === 'typecheck' || value === 'smoke' || value === 'integration' || value === 'reliability';
}

export function parseVerifySuites(raw: string | undefined): VerifySuite[] {
  if (!raw) {
    return [...DEFAULT_VERIFY_SUITES];
  }

  const parsed = raw
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return [...DEFAULT_VERIFY_SUITES];
  }

  const suites: VerifySuite[] = [];

  for (const suiteRaw of parsed) {
    if (!isVerifySuite(suiteRaw)) {
      throw new Error(
        `Unknown suite: ${suiteRaw}. Expected one of typecheck, smoke, integration, reliability.`,
      );
    }

    if (!suites.includes(suiteRaw)) {
      suites.push(suiteRaw);
    }
  }

  return suites;
}

export function parseVerificationTier(raw: string | undefined): VerificationTier | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toUpperCase();
  if (normalized === 'LIGHT' || normalized === 'STANDARD' || normalized === 'THOROUGH') {
    return normalized;
  }

  throw new Error('Unknown tier. Expected one of light, standard, thorough.');
}

export function suitesForTier(tier: VerificationTier): VerifySuite[] {
  return [...VERIFY_SUITES_BY_TIER[tier]];
}

export function formatVerifyReport(report: VerifyReport): string {
  const lines = ['Verify report:', ''];

  for (const suiteResult of report.suites) {
    lines.push(
      `- [${suiteResult.status.toUpperCase()}] ${suiteResult.suite}: ${suiteResult.command} (exit=${suiteResult.exitCode}, ${suiteResult.durationMs}ms)`,
    );
  }

  if (report.executionMode === 'dry-run') {
    lines.push('', 'Overall: dry-run (plan only, no suites executed)');
  } else {
    lines.push('', `Overall: ${report.ok ? 'pass' : 'fail'}`);
  }

  return lines.join('\n');
}

export async function runCommand(command: string, cwd: string): Promise<CommandExecutionResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn('sh', ['-lc', command], {
      cwd,
      stdio: 'inherit',
    });

    child.on('error', () => {
      resolve({
        exitCode: 1,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

export async function runVerificationSuites(
  input: VerifyRunnerInput,
  commandExecutor: VerifyCommandExecutor = runCommand,
): Promise<VerifyReport> {
  const results: VerifySuiteResult[] = [];

  for (const suite of input.suites) {
    const command = VERIFY_COMMANDS[suite];

    if (input.dryRun) {
      results.push({
        suite,
        command,
        status: 'skipped',
        exitCode: 0,
        durationMs: 0,
      });
      continue;
    }

    const commandResult = await commandExecutor(command, input.cwd);

    results.push({
      suite,
      command,
      status: commandResult.exitCode === 0 ? 'passed' : 'failed',
      exitCode: commandResult.exitCode,
      durationMs: commandResult.durationMs,
    });
  }

  return {
    ok: results.every((result) => result.status === 'passed'),
    executionMode: input.dryRun ? 'dry-run' : 'executed',
    suites: results,
  };
}
