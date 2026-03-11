import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  acquireFileLock as acquireSharedLock,
  releaseFileLock,
  lockPathFor,
} from '../lib/file-lock.js';
import type { FileLockOptions } from '../lib/file-lock.js';

/** Default lock acquisition timeout in milliseconds. */
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;

export interface LockOptions {
  /** Maximum time in ms to wait for lock acquisition (default: 5000). */
  timeoutMs?: number;
  /** Age in ms after which a lock is considered stale (default: 30000). */
  staleLockAgeMs?: number;
}

function toSharedLockOpts(options?: LockOptions): FileLockOptions {
  return {
    timeoutMs: options?.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    staleLockMs: options?.staleLockAgeMs,
  };
}

/**
 * Acquire an advisory file lock using O_EXCL (atomic create-or-fail).
 * Returns a release function that removes the lockfile.
 */
export async function acquireFileLock(
  filePath: string,
  options: LockOptions = {},
): Promise<() => Promise<void>> {
  const lockPath = lockPathFor(filePath);
  const opts = toSharedLockOpts(options);
  const handle = await acquireSharedLock(lockPath, opts);
  if (!handle) {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    throw new Error(
      `Failed to acquire file lock for ${filePath}: timed out after ${timeoutMs}ms`,
    );
  }
  return async () => {
    releaseFileLock(handle);
  };
}

/**
 * Execute a callback while holding an advisory file lock.
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const release = await acquireFileLock(filePath, options);
  try {
    return await fn();
  } finally {
    await release();
  }
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile<T>(
  filePath: string,
): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw new Error(
      `Failed to read JSON file at ${filePath}: ${(error as Error).message}`,
    );
  }
}

export async function writeJsonFile(
  filePath: string,
  value: unknown,
  spacing = 2,
  lockOptions?: LockOptions,
): Promise<void> {
  await withFileLock(
    filePath,
    async () => {
      await ensureDirectory(path.dirname(filePath));

      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = `${JSON.stringify(value, null, spacing)}\n`;

      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, filePath);
    },
    lockOptions ?? {},
  );
}

export async function appendNdjsonFile(
  filePath: string,
  value: unknown,
  lockOptions?: LockOptions,
): Promise<void> {
  await withFileLock(
    filePath,
    async () => {
      await ensureDirectory(path.dirname(filePath));
      await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
    },
    lockOptions ?? {},
  );
}

export async function writeNdjsonFile(
  filePath: string,
  values: readonly unknown[],
  lockOptions?: LockOptions,
): Promise<void> {
  await withFileLock(
    filePath,
    async () => {
      await ensureDirectory(path.dirname(filePath));
      const payload = values.length > 0
        ? `${values.map((value) => JSON.stringify(value)).join('\n')}\n`
        : '';
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, filePath);
    },
    lockOptions ?? {},
  );
}

export async function readNdjsonFile<T>(filePath: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }

    throw new Error(
      `Failed to read NDJSON file at ${filePath}: ${(error as Error).message}`,
    );
  }

  const results: T[] = [];
  const lines = raw.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    try {
      results.push(JSON.parse(line) as T);
    } catch {
      console.warn(
        `[readNdjsonFile] Skipping malformed line in ${filePath}: ${line.slice(0, 120)}`,
      );
    }
  }

  return results;
}
