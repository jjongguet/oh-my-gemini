import { formatSetupResult, runSetup } from '../../installer/index.js';
import { isSetupScope, type SetupScope } from '../../installer/scopes.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface SetupCommandContext {
  cwd: string;
  io: CliIo;
  setupRunner?: typeof runSetup;
}

function printSetupHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg setup [--scope <project|user>] [--dry-run] [--json]',
    '',
    'Post-install contract:',
    '  After npm install -g oh-my-gemini-sisyphus, run setup to apply local files.',
    '  Supported entrypoints: omg setup ... / oh-my-gemini setup ...',
    '',
    'Options:',
    '  --scope <scope>   Installation scope (project | user)',
    '  --dry-run         Show planned actions without writing files',
    '  --json            Print full result as JSON',
    '  --help            Show command help',
  ].join('\n'));
}

export async function executeSetupCommand(
  argv: string[],
  context: SetupCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printSetupHelp(io);
    return { exitCode: 0 };
  }

  const scopeRaw = getStringOption(parsed.options, ['scope']);
  let scope: SetupScope | undefined;

  if (scopeRaw !== undefined) {
    if (!isSetupScope(scopeRaw)) {
      io.stderr(`Invalid --scope value: ${scopeRaw}. Expected: project | user`);
      return { exitCode: 2 };
    }
    scope = scopeRaw;
  }

  const dryRun = hasFlag(parsed.options, ['dry-run']);
  const jsonOutput = hasFlag(parsed.options, ['json']);

  const setupRunner = context.setupRunner ?? runSetup;

  const result = await setupRunner({
    cwd: context.cwd,
    scope,
    dryRun,
  });

  if (jsonOutput) {
    io.stdout(JSON.stringify(result, null, 2));
  } else {
    io.stdout(formatSetupResult(result));
  }

  return {
    exitCode: 0,
  };
}
