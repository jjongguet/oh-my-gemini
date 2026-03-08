import path from 'node:path';

import { appendNdjsonFile, readNdjsonFile } from './filesystem.js';

export interface SessionRecord {
  id: string;
  command: string;
  cwd: string;
  status: 'completed' | 'failed' | 'blocked' | 'running';
  startedAt: string;
  completedAt?: string;
  provider?: string;
  summary?: string;
  artifactPath?: string;
  rateLimited?: boolean;
  metadata?: Record<string, unknown>;
}

function resolveSessionRegistryPath(cwd: string): string {
  return path.join(cwd, '.omg', 'state', 'sessions', 'registry.ndjson');
}

function normalizeIsoTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

function normalizeSessionRecord(record: SessionRecord): SessionRecord {
  return {
    ...record,
    startedAt: normalizeIsoTimestamp(record.startedAt) ?? new Date().toISOString(),
    completedAt: normalizeIsoTimestamp(record.completedAt),
  };
}

export async function recordSession(cwd: string, session: SessionRecord): Promise<SessionRecord> {
  const normalized = normalizeSessionRecord(session);
  await appendNdjsonFile(resolveSessionRegistryPath(cwd), normalized);
  return normalized;
}

export async function listSessions(cwd: string): Promise<SessionRecord[]> {
  const records = await readNdjsonFile<SessionRecord>(resolveSessionRegistryPath(cwd));
  return records
    .map((record) => normalizeSessionRecord(record))
    .sort((left, right) => {
      const leftStamp = left.completedAt ?? left.startedAt;
      const rightStamp = right.completedAt ?? right.startedAt;
      return rightStamp.localeCompare(leftStamp);
    });
}
