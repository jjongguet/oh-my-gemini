import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';

import {
  acquireFileLock as acquireSharedLock,
  releaseFileLock,
} from '../lib/file-lock.js';
import { ensureDirectory } from './filesystem.js';

const MAX_IDENTIFIER_LENGTH = 128;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PATH_SEPARATOR_PATTERN = /[\\/]/;

const DEFAULT_LOCK_TIMEOUT_MS = 2_000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 25;
const DEFAULT_STALE_LOCK_MS = 30_000;

const SHARED_MEMORY_SCHEMA_VERSION = 1 as const;

type SharedMemoryChangeType = 'upsert' | 'delete' | 'handoff';

interface SharedMemoryNamespaceMeta {
  schemaVersion: typeof SHARED_MEMORY_SCHEMA_VERSION;
  namespace: string;
  sequence: number;
  activeSessionId?: string;
  updatedAt: string;
  sessions: Record<string, SharedMemorySessionState>;
}

export interface SharedMemoryEntry<TValue = unknown> {
  namespace: string;
  key: string;
  value: TValue;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBySessionId?: string;
  updatedBySessionId?: string;
  ttlSeconds?: number;
  expiresAt?: string;
}

export interface SharedMemorySessionState {
  sessionId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSequence: number;
  handoffFromSessionId?: string;
}

export interface SharedMemoryChangeEvent {
  sequence: number;
  namespace: string;
  type: SharedMemoryChangeType;
  at: string;
  key?: string;
  sessionId?: string;
  fromSessionId?: string;
  toSessionId?: string;
  reason?: string;
  entryVersion?: number;
}

export interface SharedMemorySyncEvent<TValue = unknown>
  extends SharedMemoryChangeEvent {
  entry?: SharedMemoryEntry<TValue> | null;
}

export interface SharedMemoryNamespaceSnapshot {
  namespace: string;
  sequence: number;
  activeSessionId?: string;
  updatedAt: string;
  sessions: SharedMemorySessionState[];
}

export interface SharedMemoryStateManagerOptions {
  rootDir?: string;
  cwd?: string;
  lockTimeoutMs?: number;
  lockRetryDelayMs?: number;
  staleLockMs?: number;
  durableWrites?: boolean;
}

export interface SharedMemoryWriteOptions {
  sessionId?: string;
  ttlSeconds?: number;
  claimActiveSession?: boolean;
}

export interface SharedMemoryDeleteOptions {
  sessionId?: string;
}

export interface SharedMemorySyncOptions {
  sinceSequence?: number;
  maxEvents?: number;
  sessionId?: string;
  includeEntries?: boolean;
}

export interface SharedMemorySyncResult<TValue = unknown> {
  namespace: string;
  currentSequence: number;
  activeSessionId?: string;
  sessions: SharedMemorySessionState[];
  events: SharedMemorySyncEvent<TValue>[];
}

export interface SharedMemoryHandoffOptions {
  reason?: string;
  force?: boolean;
}

function normalizeIdentifier(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }

  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`${label} exceeds max length ${MAX_IDENTIFIER_LENGTH}.`);
  }

  if (normalized === '.' || normalized === '..') {
    throw new Error(`${label} cannot be "." or "..".`);
  }

  if (PATH_SEPARATOR_PATTERN.test(normalized)) {
    throw new Error(`${label} cannot contain path separators.`);
  }

  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) {
    throw new Error(
      `${label} must use only letters, numbers, ".", "_", or "-".`,
    );
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrnoCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(entry: SharedMemoryEntry, nowMs = Date.now()): boolean {
  if (!entry.expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(entry.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  return expiresAtMs <= nowMs;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const floored = Math.floor(value);
  if (floored <= 0) {
    return fallback;
  }

  return floored;
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const floored = Math.floor(value);
  if (floored < 0) {
    return fallback;
  }

  return floored;
}

async function atomicWriteTextFile(
  filePath: string,
  content: string,
  durableWrites: boolean,
): Promise<void> {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  await ensureDirectory(dir);

  const tempPath = path.join(dir, `.${baseName}.tmp.${randomUUID()}`);
  let tempHandle: FileHandle | null = null;
  let renamed = false;

  try {
    tempHandle = await fs.open(tempPath, 'wx', 0o600);
    await tempHandle.writeFile(content, 'utf8');

    if (durableWrites) {
      await tempHandle.sync();
    }

    await tempHandle.close();
    tempHandle = null;

    await fs.rename(tempPath, filePath);
    renamed = true;

    if (durableWrites) {
      try {
        const dirHandle = await fs.open(dir, 'r');
        try {
          await dirHandle.sync();
        } finally {
          await dirHandle.close();
        }
      } catch {
        // Some filesystems do not support directory fsync.
      }
    }
  } finally {
    if (tempHandle) {
      await tempHandle.close().catch(() => undefined);
    }

    if (!renamed) {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}

export class SharedMemoryStateManager {
  readonly rootDir: string;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly staleLockMs: number;
  private readonly durableWrites: boolean;

  constructor(options: SharedMemoryStateManagerOptions = {}) {
    const cwd = options.cwd ?? process.cwd();
    const configuredRoot =
      options.rootDir ??
      process.env.OMG_SHARED_MEMORY_ROOT ??
      process.env.OMX_SHARED_MEMORY_ROOT ??
      (process.env.OMG_STATE_ROOT
        ? path.join(process.env.OMG_STATE_ROOT, 'shared-memory')
        : '.omg/state/shared-memory');

    this.rootDir = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(cwd, configuredRoot);

    this.lockTimeoutMs = toNonNegativeInteger(
      options.lockTimeoutMs,
      DEFAULT_LOCK_TIMEOUT_MS,
    );
    this.lockRetryDelayMs = Math.max(
      1,
      toPositiveInteger(options.lockRetryDelayMs, DEFAULT_LOCK_RETRY_DELAY_MS),
    );
    this.staleLockMs = Math.max(
      1,
      toPositiveInteger(options.staleLockMs, DEFAULT_STALE_LOCK_MS),
    );
    this.durableWrites = options.durableWrites ?? true;
  }

  getNamespaceDir(namespace: string): string {
    return path.join(this.rootDir, normalizeIdentifier('namespace', namespace));
  }

  getEntryPath(namespace: string, key: string): string {
    return path.join(
      this.getNamespaceDir(namespace),
      'entries',
      `${normalizeIdentifier('key', key)}.json`,
    );
  }

  async listNamespaces(): Promise<string[]> {
    await ensureDirectory(this.rootDir);
    const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  }

  async writeEntry<TValue = unknown>(
    namespace: string,
    key: string,
    value: TValue,
    options: SharedMemoryWriteOptions = {},
  ): Promise<SharedMemoryEntry<TValue>> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const normalizedKey = normalizeIdentifier('key', key);
    const normalizedSessionId = options.sessionId
      ? normalizeIdentifier('sessionId', options.sessionId)
      : undefined;

    return this.withNamespaceLock(normalizedNamespace, async () => {
      await this.ensureNamespaceScaffold(normalizedNamespace);

      const entryPath = this.getEntryPath(normalizedNamespace, normalizedKey);
      const now = nowIso();
      const existing = await this.readEntryRaw<TValue>(
        normalizedNamespace,
        normalizedKey,
      );

      const nextVersion = (existing?.version ?? 0) + 1;
      const ttlSeconds =
        typeof options.ttlSeconds === 'number' && options.ttlSeconds > 0
          ? Math.floor(options.ttlSeconds)
          : undefined;

      const entry: SharedMemoryEntry<TValue> = {
        namespace: normalizedNamespace,
        key: normalizedKey,
        value,
        version: nextVersion,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        createdBySessionId: existing?.createdBySessionId ?? normalizedSessionId,
        updatedBySessionId: normalizedSessionId,
        ttlSeconds,
        expiresAt:
          ttlSeconds !== undefined
            ? new Date(Date.now() + ttlSeconds * 1_000).toISOString()
            : undefined,
      };

      await this.writeJsonAtomic(entryPath, entry);

      const meta = await this.readNamespaceMeta(normalizedNamespace);
      const sequence =
        (await this.resolveCurrentSequence(normalizedNamespace, meta)) + 1;
      const updatedMeta = this.touchSession(meta, {
        sessionId: normalizedSessionId,
        at: now,
        sequence,
        claimActiveSession: options.claimActiveSession,
      });

      const event: SharedMemoryChangeEvent = {
        sequence,
        namespace: normalizedNamespace,
        type: 'upsert',
        at: now,
        key: normalizedKey,
        sessionId: normalizedSessionId,
        entryVersion: entry.version,
      };

      await this.appendChangeEvent(normalizedNamespace, event);
      await this.writeNamespaceMeta(normalizedNamespace, updatedMeta);

      return entry;
    });
  }

  async readEntry<TValue = unknown>(
    namespace: string,
    key: string,
  ): Promise<SharedMemoryEntry<TValue> | null> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const normalizedKey = normalizeIdentifier('key', key);
    const entry = await this.readEntryRaw<TValue>(normalizedNamespace, normalizedKey);

    if (!entry || isExpired(entry)) {
      return null;
    }

    return entry;
  }

  async listEntries<TValue = unknown>(
    namespace: string,
  ): Promise<SharedMemoryEntry<TValue>[]> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const entriesDir = path.join(this.getNamespaceDir(normalizedNamespace), 'entries');

    let files: string[];
    try {
      files = await fs.readdir(entriesDir);
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        return [];
      }

      throw error;
    }

    const now = Date.now();
    const entries: SharedMemoryEntry<TValue>[] = [];

    for (const fileName of files.sort((left, right) => left.localeCompare(right))) {
      if (!fileName.endsWith('.json')) {
        continue;
      }

      const key = fileName.slice(0, -'.json'.length);
      const entry = await this.readEntryRaw<TValue>(normalizedNamespace, key);
      if (!entry || isExpired(entry, now)) {
        continue;
      }

      entries.push(entry);
    }

    return entries;
  }

  async deleteEntry(
    namespace: string,
    key: string,
    options: SharedMemoryDeleteOptions = {},
  ): Promise<boolean> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const normalizedKey = normalizeIdentifier('key', key);
    const normalizedSessionId = options.sessionId
      ? normalizeIdentifier('sessionId', options.sessionId)
      : undefined;

    return this.withNamespaceLock(normalizedNamespace, async () => {
      const entryPath = this.getEntryPath(normalizedNamespace, normalizedKey);

      try {
        await fs.unlink(entryPath);
      } catch (error) {
        if (isErrnoCode(error, 'ENOENT')) {
          return false;
        }

        throw error;
      }

      await this.ensureNamespaceScaffold(normalizedNamespace);

      const now = nowIso();
      const meta = await this.readNamespaceMeta(normalizedNamespace);
      const sequence =
        (await this.resolveCurrentSequence(normalizedNamespace, meta)) + 1;

      const updatedMeta = this.touchSession(meta, {
        sessionId: normalizedSessionId,
        at: now,
        sequence,
      });

      const event: SharedMemoryChangeEvent = {
        sequence,
        namespace: normalizedNamespace,
        type: 'delete',
        at: now,
        key: normalizedKey,
        sessionId: normalizedSessionId,
      };

      await this.appendChangeEvent(normalizedNamespace, event);
      await this.writeNamespaceMeta(normalizedNamespace, updatedMeta);

      return true;
    });
  }

  async handoffNamespace(
    namespace: string,
    fromSessionId: string,
    toSessionId: string,
    options: SharedMemoryHandoffOptions = {},
  ): Promise<SharedMemoryChangeEvent> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const normalizedFrom = normalizeIdentifier('fromSessionId', fromSessionId);
    const normalizedTo = normalizeIdentifier('toSessionId', toSessionId);

    return this.withNamespaceLock(normalizedNamespace, async () => {
      await this.ensureNamespaceScaffold(normalizedNamespace);

      const now = nowIso();
      const meta = await this.readNamespaceMeta(normalizedNamespace);

      if (
        !options.force &&
        meta.activeSessionId &&
        meta.activeSessionId !== normalizedFrom
      ) {
        throw new Error(
          `Cannot handoff namespace "${normalizedNamespace}": active session is "${meta.activeSessionId}", expected "${normalizedFrom}".`,
        );
      }

      const sequence =
        (await this.resolveCurrentSequence(normalizedNamespace, meta)) + 1;
      const updatedMeta = this.touchSession(meta, {
        sessionId: normalizedTo,
        at: now,
        sequence,
        claimActiveSession: true,
        handoffFromSessionId: normalizedFrom,
      });

      if (!updatedMeta.sessions[normalizedFrom]) {
        updatedMeta.sessions[normalizedFrom] = {
          sessionId: normalizedFrom,
          firstSeenAt: now,
          lastSeenAt: now,
          lastSequence: sequence,
        };
      } else {
        const from = updatedMeta.sessions[normalizedFrom];
        from.lastSeenAt = now;
        from.lastSequence = sequence;
      }

      const event: SharedMemoryChangeEvent = {
        sequence,
        namespace: normalizedNamespace,
        type: 'handoff',
        at: now,
        fromSessionId: normalizedFrom,
        toSessionId: normalizedTo,
        sessionId: normalizedTo,
        reason: options.reason,
      };

      await this.appendChangeEvent(normalizedNamespace, event);
      await this.writeNamespaceMeta(normalizedNamespace, updatedMeta);

      return event;
    });
  }

  async syncNamespace<TValue = unknown>(
    namespace: string,
    options: SharedMemorySyncOptions = {},
  ): Promise<SharedMemorySyncResult<TValue>> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const sinceSequence = Math.max(0, Math.floor(options.sinceSequence ?? 0));
    const maxEvents =
      typeof options.maxEvents === 'number' && options.maxEvents > 0
        ? Math.floor(options.maxEvents)
        : Number.POSITIVE_INFINITY;
    const normalizedSessionId = options.sessionId
      ? normalizeIdentifier('sessionId', options.sessionId)
      : undefined;

    return this.withNamespaceLock(normalizedNamespace, async () => {
      await this.ensureNamespaceScaffold(normalizedNamespace);

      const now = nowIso();
      const meta = await this.readNamespaceMeta(normalizedNamespace);
      const currentSequence = await this.resolveCurrentSequence(
        normalizedNamespace,
        meta,
      );
      let stableMeta = meta;

      if (currentSequence !== meta.sequence) {
        stableMeta = {
          ...meta,
          sequence: currentSequence,
          updatedAt: now,
        };
        await this.writeNamespaceMeta(normalizedNamespace, stableMeta);
      }

      const allEvents = await this.readChangeEvents(normalizedNamespace);

      const filteredEvents = allEvents
        .filter((event) => event.sequence > sinceSequence)
        .slice(0, maxEvents);

      const includeEntries = options.includeEntries ?? true;
      const syncEvents: SharedMemorySyncEvent<TValue>[] = [];

      for (const event of filteredEvents) {
        const syncEvent: SharedMemorySyncEvent<TValue> = { ...event };

        if (includeEntries && event.key && event.type === 'upsert') {
          syncEvent.entry = await this.readEntry<TValue>(
            normalizedNamespace,
            event.key,
          );
        }

        if (includeEntries && event.key && event.type === 'delete') {
          syncEvent.entry = null;
        }

        syncEvents.push(syncEvent);
      }

      let updatedMeta = stableMeta;
      if (normalizedSessionId) {
        updatedMeta = this.touchSession(stableMeta, {
          sessionId: normalizedSessionId,
          at: now,
          sequence: stableMeta.sequence,
        });
        await this.writeNamespaceMeta(normalizedNamespace, updatedMeta);
      }

      return {
        namespace: normalizedNamespace,
        currentSequence: updatedMeta.sequence,
        activeSessionId: updatedMeta.activeSessionId,
        sessions: Object.values(updatedMeta.sessions).sort((left, right) =>
          left.sessionId.localeCompare(right.sessionId),
        ),
        events: syncEvents,
      };
    });
  }

  async readNamespaceMetadata(
    namespace: string,
  ): Promise<SharedMemoryNamespaceSnapshot | null> {
    const normalizedNamespace = normalizeIdentifier('namespace', namespace);
    const metaPath = this.getNamespaceMetaPath(normalizedNamespace);
    const raw = await readJsonFile<SharedMemoryNamespaceMeta>(metaPath);

    if (!raw) {
      return null;
    }

    const meta = this.coerceNamespaceMeta(raw, normalizedNamespace);

    return {
      namespace: meta.namespace,
      sequence: meta.sequence,
      activeSessionId: meta.activeSessionId,
      updatedAt: meta.updatedAt,
      sessions: Object.values(meta.sessions).sort((left, right) =>
        left.sessionId.localeCompare(right.sessionId),
      ),
    };
  }

  private async withNamespaceLock<T>(
    namespace: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const lockPath = this.getNamespaceLockPath(namespace);
    const handle = await acquireSharedLock(lockPath, {
      timeoutMs: this.lockTimeoutMs,
      retryDelayMs: this.lockRetryDelayMs,
      staleLockMs: this.staleLockMs,
    });
    if (!handle) {
      throw new Error(`Failed to acquire shared-memory lock at ${lockPath}`);
    }
    try {
      return await operation();
    } finally {
      releaseFileLock(handle);
    }
  }

  private getNamespaceMetaPath(namespace: string): string {
    return path.join(this.getNamespaceDir(namespace), 'meta.json');
  }

  private getNamespaceLockPath(namespace: string): string {
    return path.join(this.getNamespaceDir(namespace), '.namespace.lock');
  }

  private getNamespaceChangesPath(namespace: string): string {
    return path.join(this.getNamespaceDir(namespace), 'changes.ndjson');
  }

  private async ensureNamespaceScaffold(namespace: string): Promise<void> {
    const namespaceDir = this.getNamespaceDir(namespace);
    await ensureDirectory(namespaceDir);
    await ensureDirectory(path.join(namespaceDir, 'entries'));

    const metaPath = this.getNamespaceMetaPath(namespace);
    const existingMeta = await readJsonFile<SharedMemoryNamespaceMeta>(metaPath);
    if (!existingMeta) {
      await this.writeNamespaceMeta(namespace, this.defaultNamespaceMeta(namespace));
    }
  }

  private defaultNamespaceMeta(namespace: string): SharedMemoryNamespaceMeta {
    return {
      schemaVersion: SHARED_MEMORY_SCHEMA_VERSION,
      namespace,
      sequence: 0,
      updatedAt: nowIso(),
      sessions: {},
    };
  }

  private async readNamespaceMeta(
    namespace: string,
  ): Promise<SharedMemoryNamespaceMeta> {
    const raw = await readJsonFile<SharedMemoryNamespaceMeta>(
      this.getNamespaceMetaPath(namespace),
    );

    return this.coerceNamespaceMeta(raw, namespace);
  }

  private async resolveCurrentSequence(
    namespace: string,
    meta: SharedMemoryNamespaceMeta,
  ): Promise<number> {
    const events = await this.readChangeEvents(namespace);
    const latestEventSequence = events.at(-1)?.sequence ?? 0;
    return Math.max(meta.sequence, latestEventSequence);
  }

  private coerceNamespaceMeta(
    raw: unknown,
    namespace: string,
  ): SharedMemoryNamespaceMeta {
    const fallback = this.defaultNamespaceMeta(namespace);
    if (!isRecord(raw)) {
      return fallback;
    }

    const sequence =
      typeof raw.sequence === 'number' && raw.sequence >= 0
        ? Math.floor(raw.sequence)
        : 0;

    const updatedAt =
      typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt
        : fallback.updatedAt;

    const activeSessionId =
      typeof raw.activeSessionId === 'string' && raw.activeSessionId.trim()
        ? normalizeIdentifier('activeSessionId', raw.activeSessionId)
        : undefined;

    const sessions: Record<string, SharedMemorySessionState> = {};
    if (isRecord(raw.sessions)) {
      for (const [sessionId, sessionRaw] of Object.entries(raw.sessions)) {
        if (!isRecord(sessionRaw)) {
          continue;
        }

        let normalizedSessionId: string;
        try {
          normalizedSessionId = normalizeIdentifier('sessionId', sessionId);
        } catch {
          continue;
        }

        const firstSeenAt =
          typeof sessionRaw.firstSeenAt === 'string' && sessionRaw.firstSeenAt.trim()
            ? sessionRaw.firstSeenAt
            : updatedAt;
        const lastSeenAt =
          typeof sessionRaw.lastSeenAt === 'string' && sessionRaw.lastSeenAt.trim()
            ? sessionRaw.lastSeenAt
            : updatedAt;

        const lastSequence =
          typeof sessionRaw.lastSequence === 'number' && sessionRaw.lastSequence >= 0
            ? Math.floor(sessionRaw.lastSequence)
            : 0;

        let handoffFromSessionId: string | undefined;
        if (
          typeof sessionRaw.handoffFromSessionId === 'string' &&
          sessionRaw.handoffFromSessionId.trim()
        ) {
          try {
            handoffFromSessionId = normalizeIdentifier(
              'handoffFromSessionId',
              sessionRaw.handoffFromSessionId,
            );
          } catch {
            handoffFromSessionId = undefined;
          }
        }

        sessions[normalizedSessionId] = {
          sessionId: normalizedSessionId,
          firstSeenAt,
          lastSeenAt,
          lastSequence,
          handoffFromSessionId,
        };
      }
    }

    return {
      schemaVersion: SHARED_MEMORY_SCHEMA_VERSION,
      namespace,
      sequence,
      activeSessionId,
      updatedAt,
      sessions,
    };
  }

  private async writeNamespaceMeta(
    namespace: string,
    meta: SharedMemoryNamespaceMeta,
  ): Promise<void> {
    const payload = `${JSON.stringify(meta, null, 2)}\n`;
    await atomicWriteTextFile(
      this.getNamespaceMetaPath(namespace),
      payload,
      this.durableWrites,
    );
  }

  private touchSession(
    meta: SharedMemoryNamespaceMeta,
    input: {
      sessionId?: string;
      at: string;
      sequence: number;
      claimActiveSession?: boolean;
      handoffFromSessionId?: string;
    },
  ): SharedMemoryNamespaceMeta {
    const next: SharedMemoryNamespaceMeta = {
      ...meta,
      sequence: input.sequence,
      updatedAt: input.at,
      sessions: { ...meta.sessions },
    };

    if (!input.sessionId) {
      return next;
    }

    const existing = next.sessions[input.sessionId];
    next.sessions[input.sessionId] = {
      sessionId: input.sessionId,
      firstSeenAt: existing?.firstSeenAt ?? input.at,
      lastSeenAt: input.at,
      lastSequence: input.sequence,
      handoffFromSessionId:
        input.handoffFromSessionId ?? existing?.handoffFromSessionId,
    };

    if (input.claimActiveSession) {
      next.activeSessionId = input.sessionId;
    }

    return next;
  }

  private async appendChangeEvent(
    namespace: string,
    event: SharedMemoryChangeEvent,
  ): Promise<void> {
    const changesPath = this.getNamespaceChangesPath(namespace);
    await ensureDirectory(path.dirname(changesPath));

    const handle = await fs.open(changesPath, 'a', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8');
      if (this.durableWrites) {
        await handle.sync();
      }
    } finally {
      await handle.close().catch(() => undefined);
    }
  }

  private async readChangeEvents(namespace: string): Promise<SharedMemoryChangeEvent[]> {
    const changesPath = this.getNamespaceChangesPath(namespace);

    let raw: string;
    try {
      raw = await fs.readFile(changesPath, 'utf8');
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        return [];
      }

      throw error;
    }

    const events: SharedMemoryChangeEvent[] = [];

    for (const rawLine of raw.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      try {
        const parsed = JSON.parse(line) as SharedMemoryChangeEvent;
        if (
          isRecord(parsed) &&
          typeof parsed.sequence === 'number' &&
          typeof parsed.namespace === 'string' &&
          typeof parsed.type === 'string' &&
          typeof parsed.at === 'string'
        ) {
          events.push(parsed);
        }
      } catch {
        // Skip malformed line.
      }
    }

    events.sort((left, right) => left.sequence - right.sequence);
    return events;
  }

  private async readEntryRaw<TValue = unknown>(
    namespace: string,
    key: string,
  ): Promise<SharedMemoryEntry<TValue> | null> {
    const entryPath = this.getEntryPath(namespace, key);
    const raw = await readJsonFile<SharedMemoryEntry<TValue>>(entryPath);

    if (!raw || !isRecord(raw)) {
      return null;
    }

    const createdAt =
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt
        : nowIso();
    const updatedAt =
      typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt
        : createdAt;

    const version =
      typeof raw.version === 'number' && raw.version >= 1
        ? Math.floor(raw.version)
        : 1;

    return {
      namespace:
        typeof raw.namespace === 'string' && raw.namespace.trim()
          ? raw.namespace
          : namespace,
      key: typeof raw.key === 'string' && raw.key.trim() ? raw.key : key,
      value: raw.value as TValue,
      version,
      createdAt,
      updatedAt,
      createdBySessionId:
        typeof raw.createdBySessionId === 'string'
          ? raw.createdBySessionId
          : undefined,
      updatedBySessionId:
        typeof raw.updatedBySessionId === 'string'
          ? raw.updatedBySessionId
          : undefined,
      ttlSeconds:
        typeof raw.ttlSeconds === 'number' && raw.ttlSeconds > 0
          ? Math.floor(raw.ttlSeconds)
          : undefined,
      expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : undefined,
    };
  }

  private async writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
    await atomicWriteTextFile(
      filePath,
      `${JSON.stringify(value, null, 2)}\n`,
      this.durableWrites,
    );
  }
}
