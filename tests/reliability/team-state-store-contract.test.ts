import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/team-state-store.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: team state store durable contract', () => {
  test('ensureTeamScaffold creates deterministic tasks/mailbox/events/workers directories', async () => {
    const tempRoot = createTempDir('omg-state-scaffold-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      await store.ensureTeamScaffold('contract-team');

      const teamDir = path.join(tempRoot, '.omg', 'state', 'team', 'contract-team');
      expect(existsSync(path.join(teamDir, 'events'))).toBe(true);
      expect(existsSync(path.join(teamDir, 'workers'))).toBe(true);
      expect(existsSync(path.join(teamDir, 'tasks'))).toBe(true);
      expect(existsSync(path.join(teamDir, 'mailbox'))).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('task writes enforce monotonic version CAS on canonical task-<id>.json files', async () => {
    const tempRoot = createTempDir('omg-state-task-cas-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      const created = await store.writeTask('contract-team', {
        id: '1',
        subject: 'first task',
        status: 'pending',
        required: true,
      });

      expect(created.version).toBe(1);
      expect(created.status).toBe('pending');

      const updated = await store.writeTask(
        'contract-team',
        {
          id: '1',
          subject: 'first task',
          status: 'completed',
          required: true,
          result: 'ok',
        },
        {
          expectedVersion: 1,
        },
      );

      expect(updated.version).toBe(2);
      expect(updated.status).toBe('completed');
      expect(updated.result).toBe('ok');

      await expect(
        store.writeTask(
          'contract-team',
          {
            id: '1',
            subject: 'first task',
            status: 'completed',
            required: true,
          },
          {
            expectedVersion: 1,
          },
        ),
      ).rejects.toThrow(/(version mismatch|cas mismatch)/i);

      const taskFilePath = path.join(
        tempRoot,
        '.omg',
        'state',
        'team',
        'contract-team',
        'tasks',
        'task-1.json',
      );
      expect(existsSync(taskFilePath)).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readPhaseState maps legacy "complete" terminal phase to canonical "completed"', async () => {
    const tempRoot = createTempDir('omg-state-phase-compat-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      await store.ensureTeamScaffold('contract-team');

      const phasePath = store.getPhaseFilePath('contract-team');
      await fs.writeFile(
        phasePath,
        JSON.stringify(
          {
            teamName: 'contract-team',
            runId: 'legacy-run',
            currentPhase: 'complete',
            maxFixAttempts: 1,
            currentFixAttempt: 0,
            transitions: [
              {
                teamName: 'contract-team',
                runId: 'legacy-run',
                from: 'verify',
                to: 'complete',
                at: new Date().toISOString(),
              },
            ],
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );

      const phase = await store.readPhaseState('contract-team');
      expect(phase?.currentPhase).toBe('completed');
      expect(phase?.transitions[0]?.to).toBe('completed');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('mailbox append/list uses ndjson with stable message_id records', async () => {
    const tempRoot = createTempDir('omg-state-mailbox-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      await store.appendMailboxMessage('contract-team', 'leader-fixed', {
        messageId: 'm-1',
        fromWorker: 'worker-1',
        toWorker: 'leader-fixed',
        body: 'first',
      });
      await store.appendMailboxMessage('contract-team', 'leader-fixed', {
        messageId: 'm-2',
        fromWorker: 'worker-2',
        toWorker: 'leader-fixed',
        body: 'second',
      });

      const messages = await store.readMailboxMessages('contract-team', 'leader-fixed');
      expect(messages).toHaveLength(2);
      expect(messages.map((message) => message.messageId)).toStrictEqual(['m-1', 'm-2']);
      expect(messages.map((message) => message.body)).toStrictEqual(['first', 'second']);

      const mailboxPath = path.join(
        tempRoot,
        '.omg',
        'state',
        'team',
        'contract-team',
        'mailbox',
        'leader-fixed.ndjson',
      );
      expect(existsSync(mailboxPath)).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });
});
