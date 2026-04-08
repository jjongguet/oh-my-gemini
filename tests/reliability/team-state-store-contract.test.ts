import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
  TeamStateStore,
} from '../../src/state/team-state-store.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: team state store durable contract', () => {
  test('canonicalizes mixed-case and spaced team names to deterministic lowercase namespace', async () => {
    const tempRoot = createTempDir('omp-state-team-canonical-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await store.ensureTeamScaffold('My Team');
      await store.writeTask('My Team', {
        id: '1',
        subject: 'canonical namespace task',
        status: 'pending',
      });

      const canonicalTask = await store.readTask('my-team', '1');
      expect(canonicalTask?.teamName).toBe('my-team');

      const canonicalTeamDir = path.join(
        tempRoot,
        '.omp',
        'state',
        'team',
        'my-team',
      );
      expect(existsSync(canonicalTeamDir)).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('resolves state root env precedence: OMP_TEAM_STATE_ROOT > OMX_TEAM_STATE_ROOT > OMP_STATE_ROOT', () => {
    const tempRoot = createTempDir('omp-state-root-env-precedence-');

    const previousOmpTeamStateRoot = process.env.OMP_TEAM_STATE_ROOT;
    const previousOmxTeamStateRoot = process.env.OMX_TEAM_STATE_ROOT;
    const previousOmpStateRoot = process.env.OMP_STATE_ROOT;

    try {
      const explicitRoot = path.join(tempRoot, 'explicit-root');
      const omgTeamRoot = path.join(tempRoot, 'omp-team-root');
      const omxTeamRoot = path.join(tempRoot, 'omx-team-root');
      const omgStateRoot = path.join(tempRoot, 'omp-state-root');

      process.env.OMP_TEAM_STATE_ROOT = omgTeamRoot;
      process.env.OMX_TEAM_STATE_ROOT = omxTeamRoot;
      process.env.OMP_STATE_ROOT = omgStateRoot;

      const fromOmpTeam = new TeamStateStore({ cwd: tempRoot });
      expect(fromOmpTeam.rootDir).toBe(omgTeamRoot);

      delete process.env.OMP_TEAM_STATE_ROOT;
      const fromOmxTeam = new TeamStateStore({ cwd: tempRoot });
      expect(fromOmxTeam.rootDir).toBe(omxTeamRoot);

      delete process.env.OMX_TEAM_STATE_ROOT;
      const fromOmpState = new TeamStateStore({ cwd: tempRoot });
      expect(fromOmpState.rootDir).toBe(omgStateRoot);

      const explicit = new TeamStateStore({
        cwd: tempRoot,
        rootDir: explicitRoot,
      });
      expect(explicit.rootDir).toBe(explicitRoot);
    } finally {
      if (previousOmpTeamStateRoot === undefined) {
        delete process.env.OMP_TEAM_STATE_ROOT;
      } else {
        process.env.OMP_TEAM_STATE_ROOT = previousOmpTeamStateRoot;
      }

      if (previousOmxTeamStateRoot === undefined) {
        delete process.env.OMX_TEAM_STATE_ROOT;
      } else {
        process.env.OMX_TEAM_STATE_ROOT = previousOmxTeamStateRoot;
      }

      if (previousOmpStateRoot === undefined) {
        delete process.env.OMP_STATE_ROOT;
      } else {
        process.env.OMP_STATE_ROOT = previousOmpStateRoot;
      }

      removeDir(tempRoot);
    }
  });

  test('rejects path traversal identifiers for mailbox message and audit event ids', async () => {
    const tempRoot = createTempDir('omp-state-id-guard-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await expect(
        store.appendMailboxMessage('contract-team', 'leader-fixed', {
          messageId: '../bad-message',
          fromWorker: 'worker-1',
          body: 'blocked',
        }),
      ).rejects.toThrow(/\[OMP_STATE_IDENTIFIER_PATH_TRAVERSAL\]/);

      await expect(
        store.appendTaskAuditEvent('contract-team', {
          eventId: '../bad-event',
          taskId: '1',
          action: 'claim',
          worker: 'worker-1',
        }),
      ).rejects.toThrow(/\[OMP_STATE_IDENTIFIER_PATH_TRAVERSAL\]/);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('rejects path traversal identifiers for team/worker/task state paths', async () => {
    const tempRoot = createTempDir('omp-state-identifier-guard-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await expect(store.ensureTeamScaffold('../escape')).rejects.toThrow(
        /\[OMP_STATE_IDENTIFIER_PATH_TRAVERSAL\]/,
      );

      await expect(
        store.appendMailboxMessage('contract-team', '../leader-fixed', {
          fromWorker: 'worker-1',
          body: 'blocked',
        }),
      ).rejects.toThrow(/\[OMP_STATE_IDENTIFIER_PATH_TRAVERSAL\]/);

      await expect(
        store.writeTask('contract-team', {
          id: '../1',
          subject: 'blocked',
          status: 'pending',
        }),
      ).rejects.toThrow(/\[OMP_STATE_IDENTIFIER_PATH_TRAVERSAL\]/);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('ensureTeamScaffold creates deterministic tasks/mailbox/events/workers directories', async () => {
    const tempRoot = createTempDir('omp-state-scaffold-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await store.ensureTeamScaffold('contract-team');

      const teamDir = path.join(tempRoot, '.omp', 'state', 'team', 'contract-team');
      expect(existsSync(path.join(teamDir, 'events'))).toBe(true);
      expect(existsSync(path.join(teamDir, 'workers'))).toBe(true);
      expect(existsSync(path.join(teamDir, 'tasks'))).toBe(true);
      expect(existsSync(path.join(teamDir, 'mailbox'))).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('task writes enforce monotonic version CAS on canonical task-<id>.json files', async () => {
    const tempRoot = createTempDir('omp-state-task-cas-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
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
          lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
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
            lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
          },
        ),
      ).rejects.toThrow(/(version mismatch|cas mismatch)/i);

      const taskFilePath = path.join(
        tempRoot,
        '.omp',
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

  test('task lifecycle mutations reject direct state-store writes without control-plane scope', async () => {
    const tempRoot = createTempDir('omp-state-task-lifecycle-guard-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await store.writeTask('contract-team', {
        id: '1',
        subject: 'guarded task',
        status: 'pending',
      });

      await expect(
        store.writeTask(
          'contract-team',
          {
            id: '1',
            subject: 'guarded task',
            status: 'completed',
          },
          {
            expectedVersion: 1,
          },
        ),
      ).rejects.toThrow(/requires TeamControlPlane claim\/transition\/release APIs/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readPhaseState maps legacy "complete" terminal phase to canonical "completed"', async () => {
    const tempRoot = createTempDir('omp-state-phase-compat-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
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
    const tempRoot = createTempDir('omp-state-mailbox-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
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
        '.omp',
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

  test('task audit append/list uses ndjson with stable claim/transition entries', async () => {
    const tempRoot = createTempDir('omp-state-task-audit-');

    try {
      const store = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await store.appendTaskAuditEvent('contract-team', {
        taskId: '1',
        action: 'claim',
        worker: 'worker-1',
        fromStatus: 'pending',
        toStatus: 'in_progress',
        claimTokenDigest: 'claim-token-digest',
        reasonCode: 'OMP_CP_TASK_CLAIM_ACCEPTED',
      });
      await store.appendTaskAuditEvent('contract-team', {
        taskId: '1',
        action: 'transition',
        worker: 'worker-1',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        claimTokenDigest: 'claim-token-digest',
      });

      const events = await store.readTaskAuditEvents('contract-team');
      expect(events).toHaveLength(2);
      expect(events.map((event) => event.action)).toStrictEqual([
        'claim',
        'transition',
      ]);
      expect(events.map((event) => event.reasonCode)).toStrictEqual([
        'OMP_CP_TASK_CLAIM_ACCEPTED',
        undefined,
      ]);
      expect(events.map((event) => event.taskId)).toStrictEqual(['1', '1']);
      expect(events.every((event) => typeof event.eventId === 'string' && event.eventId.length > 0)).toBe(
        true,
      );

      const auditPath = path.join(
        tempRoot,
        '.omp',
        'state',
        'team',
        'contract-team',
        'events',
        'task-lifecycle.ndjson',
      );
      expect(existsSync(auditPath)).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });
});
