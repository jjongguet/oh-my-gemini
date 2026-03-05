import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/team-state-store.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: team state store io surfaces', () => {
  test('writeWorkerInbox appends trailing newline and read/write worker done round-trips', async () => {
    const tempRoot = createTempDir('omg-state-io-worker-inbox-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      await store.writeWorkerInbox('contract-team', 'worker-1', 'finish task 1');

      const inboxPath = store.getWorkerInboxPath('contract-team', 'worker-1');
      const inboxRaw = await fs.readFile(inboxPath, 'utf8');
      expect(inboxRaw).toBe('finish task 1\n');

      await store.writeWorkerDone({
        teamName: 'contract-team',
        workerName: 'worker-1',
        status: 'completed',
        summary: 'done',
        taskId: '1',
        completedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
      });

      const done = await store.readWorkerDone('contract-team', 'worker-1');
      expect(done).toMatchObject({
        teamName: 'contract-team',
        workerName: 'worker-1',
        status: 'completed',
        taskId: '1',
      });
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readMailboxMessages falls back to legacy mailbox json payloads', async () => {
    const tempRoot = createTempDir('omg-state-io-legacy-mailbox-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      const legacyMailboxPath = store.getLegacyMailboxPath('contract-team', 'leader-fixed');
      await fs.mkdir(path.dirname(legacyMailboxPath), { recursive: true });
      await fs.writeFile(
        legacyMailboxPath,
        JSON.stringify(
          {
            messages: [
              {
                message_id: 'legacy-1',
                from_worker: 'worker-1',
                to_worker: 'leader-fixed',
                body: 'legacy body',
                created_at: new Date('2026-03-01T00:00:00.000Z').toISOString(),
              },
            ],
          },
          null,
          2,
        ),
        'utf8',
      );

      const messages = await store.readMailboxMessages('contract-team', 'leader-fixed');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        messageId: 'legacy-1',
        fromWorker: 'worker-1',
        toWorker: 'leader-fixed',
        body: 'legacy body',
      });
    } finally {
      removeDir(tempRoot);
    }
  });

  test('listMailboxWorkers returns sorted unique worker identifiers across ndjson/json files', async () => {
    const tempRoot = createTempDir('omg-state-io-mailbox-workers-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      const mailboxDir = store.getMailboxDir('contract-team');
      await fs.mkdir(mailboxDir, { recursive: true });
      await fs.writeFile(path.join(mailboxDir, 'worker-2.ndjson'), '', 'utf8');
      await fs.writeFile(path.join(mailboxDir, 'worker-1.json'), '{}', 'utf8');
      await fs.writeFile(path.join(mailboxDir, 'worker-2.json'), '{}', 'utf8');
      await fs.writeFile(path.join(mailboxDir, 'ignore.tmp'), 'x', 'utf8');

      const workers = await store.listMailboxWorkers('contract-team');
      expect(workers).toStrictEqual(['worker-1', 'worker-2']);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readAllWorker* aggregators include only workers with corresponding persisted artifacts', async () => {
    const tempRoot = createTempDir('omg-state-io-read-all-workers-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      await store.ensureTeamScaffold('contract-team');
      await fs.mkdir(store.getWorkerDir('contract-team', 'worker-1'), { recursive: true });
      await fs.mkdir(store.getWorkerDir('contract-team', 'worker-2'), { recursive: true });

      await store.writeWorkerHeartbeat({
        teamName: 'contract-team',
        workerName: 'worker-1',
        alive: true,
        updatedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
      });

      await store.writeWorkerStatus('contract-team', 'worker-1', {
        state: 'in_progress',
        updatedAt: new Date('2026-03-01T00:00:01.000Z').toISOString(),
      });

      await store.writeWorkerDone({
        teamName: 'contract-team',
        workerName: 'worker-1',
        status: 'completed',
        summary: 'done',
        completedAt: new Date('2026-03-01T00:00:02.000Z').toISOString(),
      });

      const heartbeats = await store.readAllWorkerHeartbeats('contract-team');
      const statuses = await store.readAllWorkerStatuses('contract-team');
      const doneSignals = await store.readAllWorkerDoneSignals('contract-team');

      expect(Object.keys(heartbeats)).toStrictEqual(['worker-1']);
      expect(Object.keys(statuses)).toStrictEqual(['worker-1']);
      expect(Object.keys(doneSignals)).toStrictEqual(['worker-1']);
      expect(heartbeats['worker-1']?.alive).toBe(true);
      expect(statuses['worker-1']?.state).toBe('in_progress');
      expect(doneSignals['worker-1']?.status).toBe('completed');
    } finally {
      removeDir(tempRoot);
    }
  });
});
