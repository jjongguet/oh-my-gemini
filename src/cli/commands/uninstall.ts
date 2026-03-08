import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';

const execFileAsync = promisify(execFile);

export interface UninstallCommandContext {
  cwd: string;
  io: CliIo;
  uninstallRunner?: () => Promise<{ exitCode: number; message: string; details?: Record<string, unknown> }>;
}

function printUninstallHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg uninstall [--json]',
    '',
    'Uninstalls the globally installed oh-my-gemini-sisyphus package using npm.',
    '',
    'Options:',
    '  --json   Print machine-readable output',
    '  --help   Show command help',
  ].join('\n'));
}

async function defaultUninstallRunner(): Promise<{ exitCode: number; message: string; details?: Record<string, unknown> }> {
  const require = createRequire(import.meta.url);
  const pkg = require('../../../package.json') as { name?: string };
  const packageName = pkg.name ?? 'oh-my-gemini-sisyphus';

  const result = await execFileAsync('npm', ['uninstall', '-g', packageName], {
    cwd: process.cwd(),
    env: process.env,
  });

  return {
    exitCode: 0,
    message: `Uninstalled ${packageName} via npm uninstall -g.`,
    details: {
      packageName,
      stdout: result.stdout.trim() || undefined,
      stderr: result.stderr.trim() || undefined,
    },
  };
}

export async function executeUninstallCommand(
  argv: string[],
  context: UninstallCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);
  const { io } = context;

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printUninstallHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, ['json', 'help', 'h']);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}.`);
    return { exitCode: 2 };
  }

  try {
    const output = await (context.uninstallRunner ?? defaultUninstallRunner)();
    if (hasFlag(parsed.options, ['json'])) {
      io.stdout(JSON.stringify(output, null, 2));
    } else {
      io.stdout(output.message);
      if (output.details) {
        io.stdout(JSON.stringify(output.details, null, 2));
      }
    }
    return { exitCode: output.exitCode };
  } catch (error) {
    io.stderr(`Uninstall failed: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}
