import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import {
  formatVerifyReport,
  parseVerificationTier,
  parseVerifySuites,
  runVerificationSuites,
  suitesForTier,
  type VerifyReport,
  type VerifyRunnerInput,
  type VerifySuite,
} from '../../verification/index.js';

import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface VerifyCommandContext {
  io: CliIo;
  cwd: string;
  verifyRunner?: (input: VerifyRunnerInput) => Promise<VerifyReport>;
}

function printVerifyHelp(io: CliIo): void {
  const defaultSuites = parseVerifySuites(undefined).join(',');

  io.stdout([
    'Usage: omg verify [--suite typecheck,smoke,integration,reliability] [--tier light|standard|thorough] [--dry-run] [--json]',
    '',
    'Options:',
    `  --suite <list>    Comma-separated suites. Defaults to ${defaultSuites}`,
    '  --tier <name>     Predefined suite bundle (light|standard|thorough)',
    '  --dry-run         Print planned suites without executing test commands',
    '  --json            Print machine-readable report',
    '  --help            Show command help',
  ].join('\n'));
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

  // Guard: verify only works inside the oh-my-gemini development repository.
  try {
    const pkgJson = JSON.parse(
      readFileSync(path.join(context.cwd, 'package.json'), 'utf8'),
    ) as { name?: string };
    if (pkgJson.name !== 'oh-my-gemini-sisyphus') {
      io.stderr(
        'omg verify is a development command for the oh-my-gemini repository.\n' +
        'Run it from the oh-my-gemini project root (where package.json has name "oh-my-gemini-sisyphus").',
      );
      return { exitCode: 1 };
    }
  } catch {
    io.stderr(
      'omg verify requires a package.json in the current directory.\n' +
      'This command is intended for the oh-my-gemini development repository.',
    );
    return { exitCode: 1 };
  }

  let suites: VerifySuite[];
  try {
    const suiteOption = getStringOption(parsed.options, ['suite']);
    const tierOption = getStringOption(parsed.options, ['tier']);

    if (suiteOption && tierOption) {
      io.stderr('Choose either --suite or --tier, not both.');
      return { exitCode: 2 };
    }

    const tier = parseVerificationTier(tierOption);
    suites = tier ? suitesForTier(tier) : parseVerifySuites(suiteOption);
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const input: VerifyRunnerInput = {
    suites,
    dryRun: hasFlag(parsed.options, ['dry-run']),
    cwd: context.cwd,
  };

  const runner = context.verifyRunner ?? runVerificationSuites;
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
