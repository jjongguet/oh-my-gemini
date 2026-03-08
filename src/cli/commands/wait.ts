import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';
import { listSessions, recordSession } from '../../state/index.js';

export interface WaitCommandContext {
  cwd: string;
  io: CliIo;
  now?: () => Date;
}

export interface GeminiRateLimitStatus {
  rateLimited: boolean;
  source: 'usage-json' | 'output' | 'daemon-state' | 'none';
  message: string;
  updatedAt?: string;
  windowPercent?: number;
  quotaPercent?: number;
  daemonEnabled?: boolean;
}

interface WaitDaemonState {
  enabled: boolean;
  updatedAt: string;
}

const RATE_LIMIT_PATTERNS = [
  /rate\s*limit/i,
  /too many requests/i,
  /resource exhausted/i,
  /quota exceeded/i,
  /429/,
];

function daemonStatePath(cwd: string): string {
  return path.join(cwd, '.omg', 'state', 'wait-daemon.json');
}

function usageStatePath(cwd: string): string {
  return path.join(cwd, '.gemini', 'usage.json');
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPercent(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
  }
  return undefined;
}

export function detectGeminiRateLimitFromOutput(output: string): boolean {
  const normalized = output.trim();
  if (!normalized) {
    return false;
  }

  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function readWaitDaemonState(cwd: string): Promise<WaitDaemonState | null> {
  return readJsonFile<WaitDaemonState>(daemonStatePath(cwd));
}

export async function writeWaitDaemonState(cwd: string, state: WaitDaemonState): Promise<void> {
  await fs.mkdir(path.dirname(daemonStatePath(cwd)), { recursive: true });
  await fs.writeFile(daemonStatePath(cwd), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function getGeminiRateLimitStatus(cwd: string): Promise<GeminiRateLimitStatus> {
  const [usageState, daemonState, sessions] = await Promise.all([
    readJsonFile<unknown>(usageStatePath(cwd)),
    readWaitDaemonState(cwd),
    listSessions(cwd),
  ]);

  if (isRecord(usageState)) {
    const windowPercent = readPercent(usageState, ['windowPercent', 'contextWindowPercent', 'fiveHourPercent']);
    const quotaPercent = readPercent(usageState, ['quotaPercent', 'dailyPercent', 'weeklyPercent', 'monthlyPercent']);
    const candidates = [usageState.error, usageState.message, usageState.reason];
    const matchedText = candidates.find((value) => typeof value === 'string' && detectGeminiRateLimitFromOutput(value));
    const statusCode = usageState.status;
    const rateLimited = statusCode === 429 || Boolean(matchedText) || (windowPercent ?? 0) >= 100 || (quotaPercent ?? 0) >= 100;

    if (rateLimited) {
      return {
        rateLimited: true,
        source: 'usage-json',
        message: typeof matchedText === 'string' && matchedText.trim()
          ? matchedText.trim()
          : 'Gemini usage snapshot indicates a rate limit is active.',
        updatedAt: typeof usageState.updatedAt === 'string' ? usageState.updatedAt : undefined,
        windowPercent,
        quotaPercent,
        daemonEnabled: daemonState?.enabled ?? false,
      };
    }

    return {
      rateLimited: false,
      source: daemonState ? 'daemon-state' : 'usage-json',
      message: 'Gemini usage snapshot indicates no active rate limit.',
      updatedAt: typeof usageState.updatedAt === 'string' ? usageState.updatedAt : undefined,
      windowPercent,
      quotaPercent,
      daemonEnabled: daemonState?.enabled ?? false,
    };
  }

  const lastRateLimitedSession = sessions.find((session) => session.rateLimited === true);
  if (lastRateLimitedSession) {
    return {
      rateLimited: true,
      source: 'output',
      message: lastRateLimitedSession.summary ?? 'Recent Gemini CLI output indicated a rate limit.',
      updatedAt: lastRateLimitedSession.completedAt ?? lastRateLimitedSession.startedAt,
      daemonEnabled: daemonState?.enabled ?? false,
    };
  }

  return {
    rateLimited: false,
    source: daemonState ? 'daemon-state' : 'none',
    message: 'No Gemini rate limit evidence found.',
    daemonEnabled: daemonState?.enabled ?? false,
  };
}

function printWaitHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg wait [--json] [--start] [--stop]',
    '',
    'Options:',
    '  --start  Enable the auto-resume daemon state',
    '  --stop   Disable the auto-resume daemon state',
    '  --json   Print machine-readable output',
    '  --help   Show command help',
  ].join('\n'));
}

export async function executeWaitCommand(
  argv: string[],
  context: WaitCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);
  if (hasFlag(parsed.options, ['help', 'h'])) {
    printWaitHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['help', 'h', 'json', 'start', 'stop']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const start = hasFlag(parsed.options, ['start']);
  const stop = hasFlag(parsed.options, ['stop']);
  if (start && stop) {
    context.io.stderr('Cannot combine --start and --stop.');
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    return { exitCode: 2 };
  }

  const now = context.now?.() ?? new Date();

  if (start || stop) {
    const enabled = start;
    await writeWaitDaemonState(context.cwd, {
      enabled,
      updatedAt: now.toISOString(),
    });

    await recordSession(context.cwd, {
      id: `wait-${enabled ? 'start' : 'stop'}-${now.getTime()}`,
      command: 'wait',
      cwd: context.cwd,
      status: 'completed',
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      summary: enabled ? 'wait daemon enabled' : 'wait daemon disabled',
      metadata: { action: enabled ? 'start' : 'stop' },
    });
  }

  const status = await getGeminiRateLimitStatus(context.cwd);
  const payload = {
    ok: true,
    rateLimited: status.rateLimited,
    source: status.source,
    message: status.message,
    updatedAt: status.updatedAt,
    windowPercent: status.windowPercent,
    quotaPercent: status.quotaPercent,
    daemonEnabled: status.daemonEnabled ?? false,
  };

  if (hasFlag(parsed.options, ['json'])) {
    context.io.stdout(JSON.stringify(payload, null, 2));
    return { exitCode: 0 };
  }

  if (start) {
    context.io.stdout('Auto-resume daemon enabled.');
  } else if (stop) {
    context.io.stdout('Auto-resume daemon disabled.');
  }

  context.io.stdout(status.rateLimited ? 'Gemini is currently rate limited.' : 'Gemini is not currently rate limited.');
  context.io.stdout(`Source: ${status.source}`);
  context.io.stdout(`Daemon: ${(status.daemonEnabled ?? false) ? 'enabled' : 'disabled'}`);
  context.io.stdout(`Status: ${status.message}`);
  if (status.windowPercent !== undefined) {
    context.io.stdout(`Window: ${status.windowPercent}%`);
  }
  if (status.quotaPercent !== undefined) {
    context.io.stdout(`Quota: ${status.quotaPercent}%`);
  }

  return { exitCode: 0 };
}
