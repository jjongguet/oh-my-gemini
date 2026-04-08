import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';
import { summarizeTokenUsage, type TokenTrackingPeriod } from '../../state/index.js';

export interface CostCommandContext {
  cwd: string;
  io: CliIo;
  now?: () => Date;
}

function printCostHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp cost [daily|weekly|monthly] [--json]',
    '',
    'Options:',
    '  --json   Print machine-readable output',
    '  --help   Show command help',
  ].join('\n'));
}

function normalizePeriod(raw: string | undefined): TokenTrackingPeriod {
  if (!raw || raw === 'daily' || raw === 'weekly' || raw === 'monthly' || raw === 'month') {
    return (raw ?? 'daily') as TokenTrackingPeriod;
  }

  throw new Error(`Invalid cost period: ${raw}. Expected daily, weekly, or monthly.`);
}

export async function executeCostCommand(argv: string[], context: CostCommandContext): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);
  if (hasFlag(parsed.options, ['help', 'h'])) {
    printCostHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['help', 'h', 'json']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 1) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.slice(1).join(' ')}`);
    return { exitCode: 2 };
  }

  let period: TokenTrackingPeriod;
  try {
    period = normalizePeriod(parsed.positionals[0]);
  } catch (error) {
    context.io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const summary = await summarizeTokenUsage(context.cwd, period, context.now?.() ?? new Date());

  if (hasFlag(parsed.options, ['json'])) {
    context.io.stdout(JSON.stringify(summary, null, 2));
    return { exitCode: 0 };
  }

  context.io.stdout(`Cost summary (${summary.period})`);
  context.io.stdout(`Window: ${summary.windowStart} → ${summary.windowEnd}`);
  context.io.stdout(`Sessions: ${summary.sessionCount}`);
  context.io.stdout(`Commands: ${summary.commandCount}`);
  context.io.stdout(`Prompt tokens: ${summary.totalPromptTokens}`);
  context.io.stdout(`Response tokens: ${summary.totalResponseTokens}`);
  context.io.stdout(`Total tokens: ${summary.totalTokens}`);
  context.io.stdout(`Estimated cost (USD): $${summary.totalEstimatedCostUsd.toFixed(4)}`);

  if (summary.byProvider.length > 0) {
    context.io.stdout('Providers:');
    for (const provider of summary.byProvider) {
      context.io.stdout(`  ${provider.provider}: ${provider.totalTokens} tokens, $${provider.totalEstimatedCostUsd.toFixed(4)}`);
    }
  }

  return { exitCode: 0 };
}
