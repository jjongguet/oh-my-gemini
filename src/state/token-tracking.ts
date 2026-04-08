import path from 'node:path';

import { appendNdjsonFile, readNdjsonFile } from './filesystem.js';

export type TokenTrackingPeriod = 'daily' | 'weekly' | 'month' | 'monthly';

export interface TokenUsageRecord {
  sessionId: string;
  command: string;
  provider: string;
  model?: string;
  promptTextLength?: number;
  responseTextLength?: number;
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  startedAt: string;
  completedAt: string;
  metadata?: Record<string, unknown>;
}

export interface TokenUsageSummary {
  period: Exclude<TokenTrackingPeriod, 'month'>;
  windowStart: string;
  windowEnd: string;
  sessionCount: number;
  commandCount: number;
  totalPromptTokens: number;
  totalResponseTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  byProvider: Array<{
    provider: string;
    sessions: number;
    totalTokens: number;
    totalEstimatedCostUsd: number;
  }>;
  records: TokenUsageRecord[];
}

function resolveTokenLogPath(cwd: string): string {
  return path.join(cwd, '.omp', 'state', 'tokens', 'usage.ndjson');
}

function normalizeIsoTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function estimateTokensFromTextLength(length: number | undefined): number {
  if (!Number.isFinite(length) || (length ?? 0) <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil((length as number) / 4));
}

export function normalizeTokenUsageRecord(input: TokenUsageRecord): TokenUsageRecord {
  const promptTokens =
    typeof input.promptTokens === 'number' && Number.isFinite(input.promptTokens)
      ? Math.max(0, Math.round(input.promptTokens))
      : estimateTokensFromTextLength(input.promptTextLength);
  const responseTokens =
    typeof input.responseTokens === 'number' && Number.isFinite(input.responseTokens)
      ? Math.max(0, Math.round(input.responseTokens))
      : estimateTokensFromTextLength(input.responseTextLength);
  const totalTokens =
    typeof input.totalTokens === 'number' && Number.isFinite(input.totalTokens)
      ? Math.max(0, Math.round(input.totalTokens))
      : promptTokens + responseTokens;

  return {
    ...input,
    promptTokens,
    responseTokens,
    totalTokens,
    estimatedCostUsd:
      typeof input.estimatedCostUsd === 'number' && Number.isFinite(input.estimatedCostUsd)
        ? Math.max(0, input.estimatedCostUsd)
        : 0,
    startedAt: normalizeIsoTimestamp(input.startedAt),
    completedAt: normalizeIsoTimestamp(input.completedAt),
  };
}

export async function recordTokenUsage(cwd: string, input: TokenUsageRecord): Promise<TokenUsageRecord> {
  const record = normalizeTokenUsageRecord(input);
  await appendNdjsonFile(resolveTokenLogPath(cwd), record);
  return record;
}

export async function listTokenUsage(cwd: string): Promise<TokenUsageRecord[]> {
  const records = await readNdjsonFile<TokenUsageRecord>(resolveTokenLogPath(cwd));
  return records
    .map((record) => normalizeTokenUsageRecord(record))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

function normalizePeriod(period: TokenTrackingPeriod): Exclude<TokenTrackingPeriod, 'month'> {
  return period === 'month' ? 'monthly' : period;
}

function resolvePeriodWindow(period: Exclude<TokenTrackingPeriod, 'month'>, now = new Date()): {
  start: Date;
  end: Date;
} {
  const end = new Date(now);
  const start = new Date(now);

  if (period === 'daily') {
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  if (period === 'weekly') {
    const day = start.getUTCDay();
    const diff = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - diff);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export async function summarizeTokenUsage(
  cwd: string,
  period: TokenTrackingPeriod,
  now = new Date(),
): Promise<TokenUsageSummary> {
  const normalizedPeriod = normalizePeriod(period);
  const records = await listTokenUsage(cwd);
  const { start, end } = resolvePeriodWindow(normalizedPeriod, now);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const filtered = records.filter((record) => {
    const completedMs = Date.parse(record.completedAt);
    return !Number.isNaN(completedMs) && completedMs >= startMs && completedMs <= endMs;
  });

  const byProvider = new Map<string, { sessions: Set<string>; totalTokens: number; totalEstimatedCostUsd: number }>();

  for (const record of filtered) {
    const provider = record.provider || 'unknown';
    const existing = byProvider.get(provider) ?? {
      sessions: new Set<string>(),
      totalTokens: 0,
      totalEstimatedCostUsd: 0,
    };

    existing.sessions.add(record.sessionId);
    existing.totalTokens += record.totalTokens ?? 0;
    existing.totalEstimatedCostUsd += record.estimatedCostUsd ?? 0;
    byProvider.set(provider, existing);
  }

  const uniqueSessions = new Set(filtered.map((record) => record.sessionId));

  return {
    period: normalizedPeriod,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    sessionCount: uniqueSessions.size,
    commandCount: filtered.length,
    totalPromptTokens: filtered.reduce((sum, record) => sum + (record.promptTokens ?? 0), 0),
    totalResponseTokens: filtered.reduce((sum, record) => sum + (record.responseTokens ?? 0), 0),
    totalTokens: filtered.reduce((sum, record) => sum + (record.totalTokens ?? 0), 0),
    totalEstimatedCostUsd: filtered.reduce((sum, record) => sum + (record.estimatedCostUsd ?? 0), 0),
    byProvider: [...byProvider.entries()]
      .map(([provider, entry]) => ({
        provider,
        sessions: entry.sessions.size,
        totalTokens: entry.totalTokens,
        totalEstimatedCostUsd: entry.totalEstimatedCostUsd,
      }))
      .sort((left, right) => right.totalTokens - left.totalTokens || left.provider.localeCompare(right.provider)),
    records: filtered,
  };
}
