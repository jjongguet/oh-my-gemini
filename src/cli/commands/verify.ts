import { spawn } from 'node:child_process';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { DEFAULT_VERIFY_SUITES } from '../../constants.js';

import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export type VerifySuite = 'smoke' | 'integration' | 'reliability';
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

export interface VerifyCommandContext {
  io: CliIo;
  cwd: string;
  verifyRunner?: (input: VerifyRunnerInput) => Promise<VerifyReport>;
}

const VERIFY_COMMANDS: Record<VerifySuite, string> = {
  smoke: 'npm run test:smoke',
  integration: 'npm run test:integration',
  reliability: 'npm run test:reliability',
};

const DEFAULT_VERIFY_SUITE_LIST: VerifySuite[] = [...DEFAULT_VERIFY_SUITES];

function printVerifyHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg verify [--suite smoke,integration,reliability] [--dry-run] [--json]',
    '',
    'Options:',
    '  --suite <list>    Comma-separated suites. Defaults to smoke,integration,reliability',
    '  --dry-run         Print planned suites without executing test commands',
    '  --json            Print machine-readable report',
    '  --help            Show command help',
  ].join('\n'));
}

function isVerifySuite(value: string): value is VerifySuite {
  return value === 'smoke' || value === 'integration' || value === 'reliability';
}

function parseSuites(raw: string | undefined): VerifySuite[] {
  if (!raw) {
    return [...DEFAULT_VERIFY_SUITE_LIST];
  }

  const parsed = raw
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return [...DEFAULT_VERIFY_SUITE_LIST];
  }

  const suites: VerifySuite[] = [];

  for (const suiteRaw of parsed) {
    if (!isVerifySuite(suiteRaw)) {
      throw new Error(
        `Unknown suite: ${suiteRaw}. Expected one of smoke, integration, reliability.`,
      );
    }

    if (!suites.includes(suiteRaw)) {
      suites.push(suiteRaw);
    }
  }

  return suites;
}

async function runCommand(command: string, cwd: string): Promise<{ exitCode: number; durationMs: number }> {
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

async function defaultVerifyRunner(input: VerifyRunnerInput): Promise<VerifyReport> {
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

    const commandResult = await runCommand(command, input.cwd);

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

function formatVerifyReport(report: VerifyReport): string {
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

export async function executeVerifyCommand(
  argv: string[],
  context: VerifyCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printVerifyHelp(io);
    return { exitCode: 0 };
  }

  let suites: VerifySuite[];
  try {
    suites = parseSuites(getStringOption(parsed.options, ['suite']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const input: VerifyRunnerInput = {
    suites,
    dryRun: hasFlag(parsed.options, ['dry-run']),
    cwd: context.cwd,
  };

  const runner = context.verifyRunner ?? defaultVerifyRunner;
  const report = await runner(input);

  if (hasFlag(parsed.options, ['json'])) {
    io.stdout(JSON.stringify(report, null, 2));
  } else {
    io.stdout(formatVerifyReport(report));
  }

  return {
    exitCode: input.dryRun ? 0 : report.ok ? 0 : 1,
  };
}
