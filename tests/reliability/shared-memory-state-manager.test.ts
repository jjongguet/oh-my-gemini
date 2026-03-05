import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { SharedMemoryStateManager } from '../../src/state/shared-memory.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: shared memory state manager contract', () => {
  test('writes versioned entries and syncs cross-session deltas', async () => {
    const tempRoot = createTempDir('omg-shared-memory-sync-');

    try {
      const manager = new SharedMemoryStateManager({
        rootDir: path.join(tempRoot, '.omg', 'state', 'shared-memory'),
      });

      const first = await manager.writeEntry(
        'team-sync',
        'plan',
        { step: 1 },
        {
          sessionId: 'session-a',
          claimActiveSession: true,
        },
      );

      const second = await manager.writeEntry(
        'team-sync',
        'plan',
        { step: 2 },
        {
          sessionId: 'session-a',
        },
      );

      expect(first.version).toBe(1);
      expect(second.version).toBe(2);

      const sync = await manager.syncNamespace<{ step: number }>('team-sync', {
        sinceSequence: 0,
        sessionId: 'session-b',
      });

      expect(sync.currentSequence).toBe(2);
      expect(sync.activeSessionId).toBe('session-a');
      expect(sync.events.map((event) => event.type)).toStrictEqual([
        'upsert',
        'upsert',
      ]);
      expect(sync.events.at(-1)?.entry?.version).toBe(2);
      expect(sync.events.at(-1)?.entry?.value.step).toBe(2);

      const seenSessions = sync.sessions.map((session) => session.sessionId);
      expect(seenSessions).toContain('session-a');
      expect(seenSessions).toContain('session-b');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('supports session handoff ownership and enforces active-session guard', async () => {
    const tempRoot = createTempDir('omg-shared-memory-handoff-');

    try {
      const manager = new SharedMemoryStateManager({
        rootDir: path.join(tempRoot, '.omg', 'state', 'shared-memory'),
      });

      await manager.writeEntry('team-sync', 'context', { summary: 'ready' }, {
        sessionId: 'session-a',
        claimActiveSession: true,
      });

      await expect(
        manager.handoffNamespace('team-sync', 'session-z', 'session-b'),
      ).rejects.toThrow(/active session is "session-a"/i);

      const handoffEvent = await manager.handoffNamespace(
        'team-sync',
        'session-a',
        'session-b',
        {
          reason: 'resume-run',
        },
      );

      expect(handoffEvent.type).toBe('handoff');
      expect(handoffEvent.fromSessionId).toBe('session-a');
      expect(handoffEvent.toSessionId).toBe('session-b');

      const meta = await manager.readNamespaceMetadata('team-sync');
      expect(meta?.activeSessionId).toBe('session-b');
      const sessionB = meta?.sessions.find((session) => session.sessionId === 'session-b');
      expect(sessionB?.handoffFromSessionId).toBe('session-a');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('recovers stale namespace lock files to preserve cross-process progress', async () => {
    const tempRoot = createTempDir('omg-shared-memory-stale-lock-');

    try {
      const manager = new SharedMemoryStateManager({
        rootDir: path.join(tempRoot, '.omg', 'state', 'shared-memory'),
        staleLockMs: 5,
        lockTimeoutMs: 250,
        lockRetryDelayMs: 5,
      });

      const namespaceDir = manager.getNamespaceDir('stale-lock');
      await fs.mkdir(namespaceDir, { recursive: true });

      const lockPath = path.join(namespaceDir, '.namespace.lock');
      await fs.writeFile(lockPath, JSON.stringify({ pid: 999_999_999 }), 'utf8');

      const staleMs = Date.now() - 60_000;
      await fs.utimes(lockPath, staleMs / 1_000, staleMs / 1_000);

      await manager.writeEntry('stale-lock', 'task', { status: 'ok' }, {
        sessionId: 'session-a',
      });

      const entry = await manager.readEntry<{ status: string }>('stale-lock', 'task');
      expect(entry?.value.status).toBe('ok');
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('serializes concurrent writers into monotonic event sequence and versions', async () => {
    const tempRoot = createTempDir('omg-shared-memory-concurrency-');

    try {
      const rootDir = path.join(tempRoot, '.omg', 'state', 'shared-memory');
      const managerA = new SharedMemoryStateManager({ rootDir });
      const managerB = new SharedMemoryStateManager({ rootDir });

      await Promise.all([
        managerA.writeEntry('race', 'counter', { from: 'a' }, { sessionId: 'session-a' }),
        managerB.writeEntry('race', 'counter', { from: 'b' }, { sessionId: 'session-b' }),
      ]);

      const finalEntry = await managerA.readEntry<{ from: string }>('race', 'counter');
      expect(finalEntry?.version).toBe(2);

      const sync = await managerA.syncNamespace('race', { sinceSequence: 0 });
      expect(sync.events).toHaveLength(2);
      expect(sync.events[0]?.sequence).toBe(1);
      expect(sync.events[1]?.sequence).toBe(2);
    } finally {
      removeDir(tempRoot);
    }
  });
});
