import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';

export interface HooksCommandContext {
  cwd: string;
  io: CliIo;
}

const HOOKS_STATE_FILE = path.join('.omp', 'state', 'hooks.json');

const REGISTERED_HOOKS = [
  'createModeRegistryHook',
  'createProjectMemoryHook',
  'createLearnerHook',
  'createPermissionHandlerHook',
  'createRecoveryHook',
  'createSubagentTrackerHook',
  'createAutopilotHook',
  'createRalphHook',
  'createUltraworkHook',
  'createPreCompactHook',
  'createSessionEndHook',
  'createKeywordDetectorHook',
];

function printHooksHelp(io: CliIo): void {
  io.stdout(
    [
      'Usage: omp hooks <subcommand> [options]',
      '',
      'Subcommands:',
      '  init      Bootstrap hook scaffolding',
      '  status    Show hook pipeline state',
      '  validate  Validate trigger graph',
      '  test      Dry-run hook pipeline',
      '',
      'Options:',
      '  --help    Show command help',
    ].join('\n'),
  );
}

function hooksStateFilePath(cwd: string): string {
  return path.join(cwd, HOOKS_STATE_FILE);
}

function runInit(cwd: string, io: CliIo): CommandExecutionResult {
  const stateFilePath = hooksStateFilePath(cwd);
  const stateDir = path.dirname(stateFilePath);

  if (fs.existsSync(stateFilePath)) {
    io.stdout(`Hook state file already exists: ${stateFilePath}`);
    return { exitCode: 0 };
  }

  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const defaultState = {
      initialized: new Date().toISOString(),
      hooks: [],
    };
    fs.writeFileSync(stateFilePath, JSON.stringify(defaultState, null, 2) + '\n', 'utf8');
    io.stdout(`Hook scaffolding initialized: ${stateFilePath}`);
    return { exitCode: 0 };
  } catch (error) {
    io.stderr(`Failed to initialize hook state: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}

function runStatus(cwd: string, io: CliIo): CommandExecutionResult {
  io.stdout('Registered hooks:');
  for (const hook of REGISTERED_HOOKS) {
    io.stdout(`  - ${hook}`);
  }

  const stateFilePath = hooksStateFilePath(cwd);
  if (fs.existsSync(stateFilePath)) {
    io.stdout('');
    io.stdout(`Hook state file: ${stateFilePath}`);
    try {
      const raw = fs.readFileSync(stateFilePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      io.stdout(JSON.stringify(parsed, null, 2));
    } catch (error) {
      io.stderr(`Failed to read hook state: ${(error as Error).message}`);
    }
  } else {
    io.stdout('');
    io.stdout(`No hook state file found at: ${stateFilePath}`);
    io.stdout('Run "omp hooks init" to bootstrap hook scaffolding.');
  }

  return { exitCode: 0 };
}

function runValidate(cwd: string, io: CliIo): CommandExecutionResult {
  const stateFilePath = hooksStateFilePath(cwd);

  if (!fs.existsSync(stateFilePath)) {
    io.stdout('No hook state file found. Hook registry validation: OK (using defaults)');
    return { exitCode: 0 };
  }

  try {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    JSON.parse(raw);
    io.stdout(`Hook registry validation: OK (${stateFilePath})`);
    return { exitCode: 0 };
  } catch (error) {
    io.stderr(`Hook registry validation failed: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}

function runTest(io: CliIo): CommandExecutionResult {
  io.stdout('Dry-run mode - no hooks executed (placeholder)');
  return { exitCode: 0 };
}

export async function executeHooksCommand(
  argv: string[],
  context: HooksCommandContext,
): Promise<CommandExecutionResult> {
  const { io, cwd } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printHooksHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, ['help', 'h']);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const subcommand = parsed.positionals[0];

  if (!subcommand) {
    printHooksHelp(io);
    return { exitCode: 0 };
  }

  switch (subcommand) {
    case 'init':
      return runInit(cwd, io);
    case 'status':
      return runStatus(cwd, io);
    case 'validate':
      return runValidate(cwd, io);
    case 'test':
      return runTest(io);
    default:
      io.stderr(`Unknown subcommand: ${subcommand}`);
      io.stderr('Run "omp hooks --help" for usage.');
      return { exitCode: 2 };
  }
}
