import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

/** Default lock acquisition timeout in milliseconds. */
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;

/** Locks older than this are considered stale and eligible for cleanup. */
const STALE_LOCK_AGE_MS = 30_000;

/** Base delay between lock acquisition retries. */
const LOCK_RETRY_INTERVAL_MS = 25;

export interface LockOptions {
  /** Maximum time in ms to wait for lock acquisition (default: 5000). */
  timeoutMs?: number;
  /** Age in ms after which a lock is considered stale (default: 30000). */
  staleLockAgeMs?: number;
}

interface LockInfo {
  pid: number;
  createdAt: number;
}

/**
 * Acquire an advisory file lock using O_EXCL (atomic create-or-fail).
 * Returns a release function that removes the lockfile.
 */
export async function acquireFileLock(
  filePath: string,
  options: LockOptions = {},
): Promise<() => Promise<void>> {
  const lockPath = `${filePath}.lock`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const staleLockAgeMs = options.staleLockAgeMs ?? STALE_LOCK_AGE_MS;
  const deadline = Date.now() + timeoutMs;

  const lockContent: LockInfo = {
    pid: process.pid,
    createdAt: Date.now(),
  };

  // Ensure the lock file's parent directory exists
  await ensureDirectory(path.dirname(lockPath));

  while (true) {
    try {
      // O_CREAT | O_EXCL | O_WRONLY — fails with EEXIST if file already exists
      const handle = await fs.open(
        lockPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      );
      await handle.writeFile(JSON.stringify(lockContent));
      await handle.close();

      // Lock acquired — return release function
      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch {
          // Lock file already removed — ignore
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      // Lock file exists — check for staleness
      await cleanStaleLock(lockPath, staleLockAgeMs);

      if (Date.now() >= deadline) {
        throw new Error(
          `Failed to acquire file lock for ${filePath}: timed out after ${timeoutMs}ms`,
        );
      }

      // Jittered retry to reduce contention
      const jitter = Math.floor(Math.random() * LOCK_RETRY_INTERVAL_MS);
      await sleep(LOCK_RETRY_INTERVAL_MS + jitter);
    }
  }
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

async function cleanStaleLock(
  lockPath: string,
  staleLockAgeMs: number,
): Promise<void> {
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    const info = JSON.parse(raw) as LockInfo;
    const age = Date.now() - info.createdAt;

    if (age > staleLockAgeMs) {
      // Stale lock — attempt removal. Another process may race us here,
      // which is fine: the next O_EXCL attempt will arbitrate.
      try {
        await fs.unlink(lockPath);
      } catch {
        // Already cleaned by another process
      }
    }
  } catch {
    // Lock file disappeared or is malformed — try to clean up
    try {
      await fs.unlink(lockPath);
    } catch {
      // Already gone
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
