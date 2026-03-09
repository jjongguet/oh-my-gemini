import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';
import { listSessions } from '../../state/index.js';

export interface SessionsCommandContext {
  cwd: string;
  io: CliIo;
}

function printSessionsHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg sessions [--json] [--limit <n>]',
    '',
    'Options:',
    '  --limit <n>  Maximum rows to print (default: 20)',
    '  --json       Print machine-readable output',
    '  --help       Show command help',
  ].join('\n'));
}

export async function executeSessionsCommand(argv: string[], context: SessionsCommandContext): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);
  if (hasFlag(parsed.options, ['help', 'h'])) {
    printSessionsHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['help', 'h', 'json', 'limit']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    return { exitCode: 2 };
  }

  const limitRaw = getStringOption(parsed.options, ['limit']);
  if (limitRaw !== undefined && (!/^\d+$/.test(limitRaw) || limitRaw === '0')) {
    context.io.stderr(`Invalid --limit value: ${limitRaw}. Expected a positive integer.`);
    return { exitCode: 2 };
  }
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;

  const sessions = (await listSessions(context.cwd)).slice(0, limit);

  if (hasFlag(parsed.options, ['json'])) {
    context.io.stdout(JSON.stringify({ count: sessions.length, sessions }, null, 2));
    return { exitCode: 0 };
  }

  if (sessions.length === 0) {
    context.io.stdout('No recorded sessions.');
    return { exitCode: 0 };
  }

  context.io.stdout('Recorded sessions:');
  for (const session of sessions) {
    context.io.stdout(`- ${session.id} [${session.status}] ${session.command} ${session.provider ? `(${session.provider})` : ''}`.trim());
    context.io.stdout(`  started: ${session.startedAt}`);
    if (session.completedAt) {
      context.io.stdout(`  completed: ${session.completedAt}`);
    }
    if (session.summary) {
      context.io.stdout(`  summary: ${session.summary}`);
    }
    if (session.artifactPath) {
      context.io.stdout(`  artifact: ${session.artifactPath}`);
    }
  }

  return { exitCode: 0 };
}
