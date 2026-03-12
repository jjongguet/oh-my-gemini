import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatSetupResult, runSetup } from '../../installer/index.js';
import { isSetupScope, type SetupScope } from '../../installer/scopes.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import { findUnknownOptions, getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

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

  const unknownOptions = findUnknownOptions(parsed.options, [
    'scope',
    'dry-run',
    'json',
    'help',
    'h',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
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

  if (scope === 'user') {
    io.stderr('Warning: --scope user is not yet implemented. Falling back to project scope.');
    scope = 'project';
  }

  const dryRun = hasFlag(parsed.options, ['dry-run']);
  const jsonOutput = hasFlag(parsed.options, ['json']);

  const setupRunner = context.setupRunner ?? runSetup;

  const result = await setupRunner({
    cwd: context.cwd,
    scope,
    dryRun,
  });

  if (!dryRun) {
    const packageRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
    );

    let linkOk = false;
    try {
      // Use 'inherit' so the user can interact with Gemini CLI's enable prompt.
      // With 'pipe', the enable prompt is suppressed and the extension stays disabled.
      execFileSync('gemini', ['extensions', 'link', packageRoot], {
        cwd: context.cwd,
        stdio: jsonOutput ? 'pipe' : 'inherit',
        timeout: 30_000,
      });
      linkOk = true;
    } catch {
      // link may fail if gemini CLI is not on PATH or prompt was declined
    }

    if (linkOk) {
      // Attempt to explicitly enable the extension in case the link prompt was
      // suppressed (e.g. --json mode) or the user skipped it.
      try {
        execFileSync('gemini', ['extensions', 'enable', 'oh-my-gemini'], {
          cwd: context.cwd,
          stdio: 'pipe',
          timeout: 15_000,
        });
      } catch {
        // 'enable' subcommand may not exist in older Gemini CLI versions — ignore
      }

      if (!jsonOutput) {
        io.stdout('Gemini extension linked successfully. Restart Gemini CLI for /omg:* commands to appear.');
      }
    } else {
      io.stderr(
        'Warning: could not auto-link Gemini extension.\n' +
        `  Run manually: gemini extensions link ${packageRoot}\n` +
        '  Then ensure it is enabled: gemini extensions list',
      );
    }
  }

  if (jsonOutput) {
    io.stdout(JSON.stringify(result, null, 2));
  } else {
    io.stdout(formatSetupResult(result));
  }

  return {
    exitCode: 0,
  };
}
