import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
  TeamStateStore,
} from '../../src/state/team-state-store.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: team state store durability contract', () => {
  test('ensureTeamScaffold creates deterministic team directories', async () => {
    const tempRoot = createTempDir('omp-state-scaffold-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await stateStore.ensureTeamScaffold('durable-team');

      const teamDir = stateStore.getTeamDir('durable-team');
      const expectedDirs = ['events', 'workers', 'tasks', 'mailbox'];

      for (const relativeDir of expectedDirs) {
        const absoluteDir = path.join(teamDir, relativeDir);
        const stat = await fs.stat(absoluteDir);
        expect(stat.isDirectory()).toBe(true);
      }
    } finally {
      removeDir(tempRoot);
    }
  });

  test('task persistence uses canonical task-<id>.json path, monotonic versioning, and CAS', async () => {
    const tempRoot = createTempDir('omp-state-task-cas-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      const created = await stateStore.writeTask('durable-team', {
        id: '1',
        subject: 'first task',
        status: 'pending',
      });

      expect(created.version).toBe(1);

      const updated = await stateStore.writeTask(
        'durable-team',
        {
          id: '1',
          subject: 'first task',
          status: 'in_progress',
          owner: 'worker-1',
        },
        {
          expectedVersion: created.version,
          lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
        },
      );

      expect(updated.version).toBe(2);
      expect(updated.status).toBe('in_progress');

      await expect(
        stateStore.writeTask(
          'durable-team',
          {
            id: '1',
            subject: 'stale write',
            status: 'completed',
          },
          {
            expectedVersion: 1,
            lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
          },
        ),
      ).rejects.toThrow(/(version mismatch|cas mismatch)/i);

      const canonicalTaskPath = stateStore.getTaskPath('durable-team', '1');
      const canonicalRaw = await fs.readFile(canonicalTaskPath, 'utf8');
      expect(canonicalRaw).toMatch(/"version": 2/);

      // Legacy compatibility: read tasks/<id>.json when canonical file does not exist.
      const legacyTaskPath = stateStore.getLegacyTaskPath('durable-team', '7');
      await fs.mkdir(path.dirname(legacyTaskPath), { recursive: true });
      await fs.writeFile(
        legacyTaskPath,
        `${JSON.stringify(
          {
            id: '7',
            subject: 'legacy task',
            status: 'pending',
            version: 4,
            created_at: '2026-02-01T00:00:00.000Z',
            updated_at: '2026-02-01T00:00:00.000Z',
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      const legacyRead = await stateStore.readTask('durable-team', '7');
      expect(legacyRead?.id).toBe('7');
      expect(legacyRead?.version).toBe(4);
      expect(legacyRead?.subject).toBe('legacy task');

      const migrated = await stateStore.writeTask(
        'durable-team',
        {
          id: '7',
          subject: 'legacy task migrated',
          status: 'completed',
        },
        {
          expectedVersion: 4,
          lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
        },
      );

      expect(migrated.version).toBe(5);
      const migratedCanonicalPath = stateStore.getTaskPath('durable-team', '7');
      await expect(fs.readFile(migratedCanonicalPath, 'utf8')).resolves.toContain(
        'legacy task migrated',
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('phase reader normalizes legacy \"complete\" terminal phase to canonical \"completed\"', async () => {
    const tempRoot = createTempDir('omp-state-phase-compat-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });
      const teamName = 'phase-compat-team';

      await stateStore.ensureTeamScaffold(teamName);
      await fs.writeFile(
        stateStore.getPhaseFilePath(teamName),
        `${JSON.stringify(
          {
            teamName,
            runId: 'run-legacy',
            currentPhase: 'complete',
            maxFixAttempts: 3,
            currentFixAttempt: 1,
            transitions: [
              {
                teamName,
                runId: 'run-legacy',
                from: 'verify',
                to: 'complete',
                at: new Date('2026-02-27T00:00:00.000Z').toISOString(),
              },
            ],
            updatedAt: new Date('2026-02-27T00:00:00.000Z').toISOString(),
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      const normalized = await stateStore.readPhaseState(teamName);
      expect(normalized?.currentPhase).toBe('completed');
      expect(normalized?.transitions[0]?.to).toBe('completed');

      if (!normalized) {
        throw new Error('Expected normalized phase state.');
      }

      await stateStore.writePhaseState(teamName, normalized);
      const persistedRaw = await fs.readFile(
        stateStore.getPhaseFilePath(teamName),
        'utf8',
      );
      expect(persistedRaw).not.toMatch(/\"complete\"/);
      expect(persistedRaw).toMatch(/\"completed\"/);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('mailbox appends are serialized for concurrent producers', async () => {
    const tempRoot = createTempDir('omp-state-mailbox-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      const writes = Array.from({ length: 40 }, (_, index) =>
        stateStore.appendMailboxMessage('durable-team', 'leader-fixed', {
          fromWorker: `worker-${(index % 4) + 1}`,
          body: `message-${index + 1}`,
        }),
      );

      const writtenMessages = await Promise.all(writes);
      expect(writtenMessages).toHaveLength(40);

      const mailboxMessages = await stateStore.readMailboxMessages(
        'durable-team',
        'leader-fixed',
      );

      expect(mailboxMessages).toHaveLength(40);
      const bodies = mailboxMessages.map((message) => message.body);
      expect(new Set(bodies).size).toBe(40);

      const workers = await stateStore.listMailboxWorkers('durable-team');
      expect(workers).toContain('leader-fixed');
    } finally {
      removeDir(tempRoot);
    }
  });
});
