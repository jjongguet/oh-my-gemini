import path from 'node:path';
import { promises as fs } from 'node:fs';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';
import { atomicWriteJson } from '../../lib/atomic-write.js';

export interface ReasoningCommandContext {
  cwd: string;
  io: CliIo;
  now?: () => Date;
}

type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

const VALID_EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];

interface ReasoningState {
  effort: ReasoningEffort;
  updatedAt: string;
}

function printReasoningHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp reasoning [low|medium|high|xhigh]',
    '',
    'Show or set the reasoning effort profile.',
    '',
    'Arguments:',
    '  low     Minimal reasoning effort',
    '  medium  Balanced reasoning effort',
    '  high    Deep reasoning effort',
    '  xhigh   Maximum reasoning effort',
    '',
    'Options:',
    '  --help   Show command help',
    '',
    'With no argument, prints the current reasoning effort.',
  ].join('\n'));
}

function isValidEffort(value: string): value is ReasoningEffort {
  return VALID_EFFORTS.includes(value as ReasoningEffort);
}

function getStateFilePath(cwd: string): string {
  return path.join(cwd, '.omp', 'state', 'reasoning.json');
}

async function readReasoningState(cwd: string): Promise<ReasoningState | null> {
  const stateFile = getStateFilePath(cwd);
  try {
    const content = await fs.readFile(stateFile, 'utf8');
    return JSON.parse(content) as ReasoningState;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

export async function executeReasoningCommand(
  argv: string[],
  context: ReasoningCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printReasoningHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['help', 'h']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 1) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.slice(1).join(' ')}`);
    return { exitCode: 2 };
  }

  const effortArg = parsed.positionals[0];

  if (effortArg === undefined) {
    // Show current state
    const state = await readReasoningState(context.cwd);
    if (state === null) {
      context.io.stdout('No reasoning effort set. Default will be used.');
      context.io.stdout(`Valid values: ${VALID_EFFORTS.join(', ')}`);
    } else {
      context.io.stdout(`Reasoning effort: ${state.effort}`);
      context.io.stdout(`Updated: ${state.updatedAt}`);
    }
    return { exitCode: 0 };
  }

  if (!isValidEffort(effortArg)) {
    context.io.stderr(`Invalid effort: ${effortArg}. Valid values: ${VALID_EFFORTS.join(', ')}`);
    return { exitCode: 2 };
  }

  const now = context.now?.() ?? new Date();
  const state: ReasoningState = {
    effort: effortArg,
    updatedAt: now.toISOString(),
  };

  const stateFile = getStateFilePath(context.cwd);
  await atomicWriteJson(stateFile, state);

  context.io.stdout(`Reasoning effort set to: ${effortArg}`);

  return { exitCode: 0 };
}
