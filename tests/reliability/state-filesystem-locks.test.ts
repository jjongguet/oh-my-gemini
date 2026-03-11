import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  acquireFileLock,
  appendNdjsonFile,
  readJsonFile,
  readNdjsonFile,
  withFileLock,
  writeJsonFile,
} from '../../src/state/filesystem.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: filesystem file locking', () => {
  test('acquireFileLock creates a .lock file and release removes it', async () => {
    const tempRoot = createTempDir('omg-lock-basic-');

    try {
      const filePath = path.join(tempRoot, 'data.json');
      const lockPath = `${filePath}.lock`;

      const release = await acquireFileLock(filePath);

      // Lock file should exist
      const stat = await fs.stat(lockPath);
      expect(stat.isFile()).toBe(true);

      // Lock file should contain valid JSON with pid and timestamp
      const content = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      expect(content).toHaveProperty('pid', process.pid);
      expect(content).toHaveProperty('timestamp');
      expect(typeof content.timestamp).toBe('number');

      await release();

      // Lock file should be gone
      await expect(fs.stat(lockPath)).rejects.toThrow();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('acquireFileLock times out when lock is held', async () => {
    const tempRoot = createTempDir('omg-lock-timeout-');

    try {
      const filePath = path.join(tempRoot, 'data.json');

      const release = await acquireFileLock(filePath);

      await expect(
        acquireFileLock(filePath, { timeoutMs: 100 }),
      ).rejects.toThrow(/timed out after 100ms/);

      await release();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('acquireFileLock cleans stale locks and acquires', async () => {
    const tempRoot = createTempDir('omg-lock-stale-');

    try {
      const filePath = path.join(tempRoot, 'data.json');
      const lockPath = `${filePath}.lock`;

      // Create a stale lock (old mtime + dead PID)
      const staleLock = { pid: 99999, timestamp: Date.now() - 60_000 };
      await fs.writeFile(lockPath, JSON.stringify(staleLock), 'utf8');
      // Set mtime to 2 seconds ago so it exceeds staleLockAgeMs (1000ms)
      const oldTimeSec = (Date.now() - 2_000) / 1_000;
      await fs.utimes(lockPath, oldTimeSec, oldTimeSec);

      // Should acquire despite existing lock because it's stale
      const release = await acquireFileLock(filePath, {
        timeoutMs: 500,
        staleLockAgeMs: 1_000,
      });

      // Verify we hold the lock
      const content = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      expect(content.pid).toBe(process.pid);

      await release();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('acquireFileLock cleans malformed lock files', async () => {
    const tempRoot = createTempDir('omg-lock-malformed-');

    try {
      const filePath = path.join(tempRoot, 'data.json');
      const lockPath = `${filePath}.lock`;

      // Create a malformed lock file with old mtime
      await fs.writeFile(lockPath, 'not-json!!!', 'utf8');
      const oldTimeSec = (Date.now() - 60_000) / 1_000;
      await fs.utimes(lockPath, oldTimeSec, oldTimeSec);

      const release = await acquireFileLock(filePath, { timeoutMs: 500 });
      const content = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      expect(content.pid).toBe(process.pid);

      await release();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('withFileLock releases lock even on error', async () => {
    const tempRoot = createTempDir('omg-lock-error-release-');

    try {
      const filePath = path.join(tempRoot, 'data.json');
      const lockPath = `${filePath}.lock`;

      await expect(
        withFileLock(filePath, async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      // Lock should be released despite error
      await expect(fs.stat(lockPath)).rejects.toThrow();

      // Should be able to acquire again
      const release = await acquireFileLock(filePath, { timeoutMs: 100 });
      await release();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('withFileLock serializes concurrent access', async () => {
    const tempRoot = createTempDir('omg-lock-serialize-');

    try {
      const filePath = path.join(tempRoot, 'counter.json');

      // Write initial value
      await writeJsonFile(filePath, { count: 0 });

      const order: number[] = [];

      // Launch concurrent operations that must serialize
      const tasks = Array.from({ length: 5 }, (_, i) =>
        withFileLock(filePath, async () => {
          order.push(i);
          // Small delay to make contention visible
          await new Promise((r) => setTimeout(r, 10));
        }),
      );

      await Promise.all(tasks);

      // All 5 operations should have completed
      expect(order).toHaveLength(5);
      expect(new Set(order).size).toBe(5);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('concurrent writeJsonFile calls do not corrupt data', async () => {
    const tempRoot = createTempDir('omg-lock-concurrent-json-');

    try {
      const filePath = path.join(tempRoot, 'state.json');

      // Run 10 concurrent writes — last one wins but none should corrupt
      const writes = Array.from({ length: 10 }, (_, i) =>
        writeJsonFile(filePath, { writer: i, ts: Date.now() }),
      );

      await Promise.all(writes);

      // Final file should be valid JSON
      const result = await readJsonFile<{ writer: number; ts: number }>(filePath);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('writer');
      expect(typeof result!.writer).toBe('number');
      expect(result).toHaveProperty('ts');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('concurrent appendNdjsonFile calls produce no lost records', async () => {
    const tempRoot = createTempDir('omg-lock-concurrent-ndjson-');

    try {
      const filePath = path.join(tempRoot, 'events.ndjson');
      const count = 20;

      // Launch concurrent appends
      const appends = Array.from({ length: count }, (_, i) =>
        appendNdjsonFile(filePath, { id: `e${i}`, seq: i }),
      );

      await Promise.all(appends);

      // All records should be present and parseable
      const records = await readNdjsonFile<{ id: string; seq: number }>(filePath);
      expect(records).toHaveLength(count);

      // Every sequence number should appear exactly once
      const seqs = records.map((r) => r.seq).sort((a, b) => a - b);
      expect(seqs).toStrictEqual(Array.from({ length: count }, (_, i) => i));
    } finally {
      removeDir(tempRoot);
    }
  });

  test('lock file is not left behind after normal writeJsonFile', async () => {
    const tempRoot = createTempDir('omg-lock-cleanup-json-');

    try {
      const filePath = path.join(tempRoot, 'clean.json');
      const lockPath = `${filePath}.lock`;

      await writeJsonFile(filePath, { clean: true });

      // No stale lock file
      await expect(fs.stat(lockPath)).rejects.toThrow();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('lock file is not left behind after normal appendNdjsonFile', async () => {
    const tempRoot = createTempDir('omg-lock-cleanup-ndjson-');

    try {
      const filePath = path.join(tempRoot, 'clean.ndjson');
      const lockPath = `${filePath}.lock`;

      await appendNdjsonFile(filePath, { clean: true });

      // No stale lock file
      await expect(fs.stat(lockPath)).rejects.toThrow();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('double release is safe (idempotent)', async () => {
    const tempRoot = createTempDir('omg-lock-double-release-');

    try {
      const filePath = path.join(tempRoot, 'data.json');

      const release = await acquireFileLock(filePath);
      await release();
      // Second release should not throw
      await release();
    } finally {
      removeDir(tempRoot);
    }
  });
});
