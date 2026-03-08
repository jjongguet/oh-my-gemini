import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/team-state-store.js';
import { CONTROL_PLANE_FAILURE_CODES } from '../../src/team/control-plane/failure-taxonomy.js';
import { TeamControlPlane } from '../../src/team/control-plane/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

async function listTypescriptFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (entry.isFile() && next.endsWith('.ts')) {
        results.push(next);
      }
    }
  }

  return results;
}

describe('reliability: team control-plane contract', () => {
  test('resolves mixed-case team identifiers to one canonical namespace across state and control-plane', async () => {
    const tempRoot = createTempDir('omg-control-plane-team-canonical-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await stateStore.writeTask('My Team', {
        id: '1',
        subject: 'canonical team namespace',
        status: 'pending',
      });

      const claimed = await controlPlane.claimTask({
        teamName: 'my-team',
        taskId: '1',
        worker: 'worker-1',
      });

      expect(claimed.task.teamName).toBe('my-team');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('claimTask enforces dependency completion and claim ownership', async () => {
    const tempRoot = createTempDir('omg-control-plane-claim-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await stateStore.writeTask('contract-team', {
        id: '1',
        subject: 'dependency task',
        status: 'pending',
      });
      await stateStore.writeTask('contract-team', {
        id: '2',
        subject: 'dependent task',
        status: 'pending',
        dependsOn: ['1'],
      });

      await expect(
        controlPlane.claimTask({
          teamName: 'contract-team',
          taskId: '2',
          worker: 'worker-2',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_DEPENDENCIES_UNRESOLVED}\\]`),
      );

      const dependencyClaim = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
      });

      await controlPlane.transitionTaskStatus({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        claimToken: dependencyClaim.claimToken,
        from: 'in_progress',
        to: 'completed',
        result: 'dependency done',
      });

      const dependentClaim = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '2',
        worker: 'worker-2',
      });

      expect(dependentClaim.task.status).toBe('in_progress');

      await expect(
        controlPlane.claimTask({
          teamName: 'contract-team',
          taskId: '2',
          worker: 'worker-3',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_ALREADY_CLAIMED}\\]`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('transitionTaskStatus requires active matching claim token and clears claim on terminal transition', async () => {
    const tempRoot = createTempDir('omg-control-plane-transition-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      let now = new Date('2026-03-02T00:00:00.000Z');
      const controlPlane = new TeamControlPlane({
        stateStore,
        now: () => new Date(now),
      });

      await stateStore.writeTask('contract-team', {
        id: '1',
        subject: 'expiring lease task',
        status: 'pending',
      });

      const expiredClaim = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        leaseMs: 1_000,
      });

      now = new Date('2026-03-02T00:00:02.000Z');

      await expect(
        controlPlane.transitionTaskStatus({
          teamName: 'contract-team',
          taskId: '1',
          worker: 'worker-1',
          claimToken: expiredClaim.claimToken,
          from: 'in_progress',
          to: 'completed',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_LEASE_EXPIRED}\\]`),
      );

      const renewedClaim = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
      });

      await expect(
        controlPlane.transitionTaskStatus({
          teamName: 'contract-team',
          taskId: '1',
          worker: 'worker-1',
          claimToken: 'wrong-token',
          from: 'in_progress',
          to: 'completed',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_TOKEN_MISMATCH}\\]`),
      );

      const completed = await controlPlane.transitionTaskStatus({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        claimToken: renewedClaim.claimToken,
        from: 'in_progress',
        to: 'completed',
        result: 'done',
      });

      expect(completed.status).toBe('completed');
      expect(completed.claim).toBeUndefined();
      expect(completed.result).toBe('done');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('releaseTaskClaim clears claim and returns task to pending by default', async () => {
    const tempRoot = createTempDir('omg-control-plane-release-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await stateStore.writeTask('contract-team', {
        id: '1',
        subject: 'release task',
        status: 'pending',
      });

      const claimed = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
      });

      const released = await controlPlane.releaseTaskClaim({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        claimToken: claimed.claimToken,
      });

      expect(released.status).toBe('pending');
      expect(released.claim).toBeUndefined();
      expect(released.owner).toBeUndefined();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('reapExpiredTaskClaims releases and reassigns expired leases', async () => {
    const tempRoot = createTempDir('omg-control-plane-reap-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      let now = new Date('2026-03-02T00:00:00.000Z');
      const controlPlane = new TeamControlPlane({
        stateStore,
        now: () => new Date(now),
      });

      await stateStore.writeTask('contract-team', {
        id: '1',
        subject: 'expired task',
        status: 'pending',
      });
      await stateStore.writeTask('contract-team', {
        id: '2',
        subject: 'expired reassign task',
        status: 'pending',
      });

      await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        leaseMs: 1_000,
      });
      await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '2',
        worker: 'worker-2',
        leaseMs: 1_000,
      });

      now = new Date('2026-03-02T00:00:02.000Z');

      const released = await controlPlane.reapExpiredTaskClaims({
        teamName: 'contract-team',
        limit: 1,
      });

      expect(released.released).toBe(1);
      expect(released.reassigned).toBe(0);
      expect(released.tasks[0]?.taskId).toBe('1');
      expect((await stateStore.readTask('contract-team', '1'))?.status).toBe('pending');

      const reassigned = await controlPlane.reapExpiredTaskClaims({
        teamName: 'contract-team',
        assignWorker: 'worker-3',
      });

      expect(reassigned.reassigned).toBe(1);
      expect(reassigned.tasks[0]?.taskId).toBe('2');
      expect(reassigned.tasks[0]?.claimToken).toBeDefined();
      const taskTwo = await stateStore.readTask('contract-team', '2');
      expect(taskTwo?.status).toBe('in_progress');
      expect(taskTwo?.claim?.owner).toBe('worker-3');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('claim/transition/release operations append task audit events', async () => {
    const tempRoot = createTempDir('omg-control-plane-task-audit-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await stateStore.writeTask('contract-team', {
        id: '1',
        subject: 'audit task',
        status: 'pending',
      });

      const claimed = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
      });

      await controlPlane.releaseTaskClaim({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        claimToken: claimed.claimToken,
      });

      const reclaimed = await controlPlane.claimTask({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
      });

      await controlPlane.transitionTaskStatus({
        teamName: 'contract-team',
        taskId: '1',
        worker: 'worker-1',
        claimToken: reclaimed.claimToken,
        from: 'in_progress',
        to: 'completed',
        result: 'done',
      });

      const events = await stateStore.readTaskAuditEvents('contract-team');
      expect(events.map((event) => event.action)).toStrictEqual([
        'claim',
        'release',
        'claim',
        'transition',
      ]);
      expect(events.map((event) => event.reasonCode)).toStrictEqual([
        'OMG_CP_TASK_CLAIM_ACCEPTED',
        'OMG_CP_TASK_RELEASE_PENDING',
        'OMG_CP_TASK_CLAIM_ACCEPTED',
        'OMG_CP_TASK_TRANSITION_COMPLETED',
      ]);
      expect(events.every((event) => event.taskId === '1')).toBe(true);
      expect(events.every((event) => event.worker === 'worker-1')).toBe(true);
      expect(
        events.every(
          (event) =>
            typeof event.claimTokenDigest === 'string' &&
            event.claimTokenDigest.length === 16,
        ),
      ).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('mailbox lifecycle supports notified/delivered markers with idempotent updates', async () => {
    const tempRoot = createTempDir('omg-control-plane-mailbox-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await controlPlane.sendMailboxMessage({
        teamName: 'contract-team',
        fromWorker: 'worker-1',
        toWorker: 'leader-fixed',
        body: 'message-1',
        messageId: 'm-1',
      });
      await controlPlane.sendMailboxMessage({
        teamName: 'contract-team',
        fromWorker: 'worker-2',
        toWorker: 'leader-fixed',
        body: 'message-2',
        messageId: 'm-2',
      });

      const delivered = await controlPlane.markMailboxMessageDelivered({
        teamName: 'contract-team',
        worker: 'leader-fixed',
        messageId: 'm-1',
      });
      expect(delivered.deliveredAt).toBeDefined();

      const rawMessageCountBefore = (
        await stateStore.readMailboxMessages('contract-team', 'leader-fixed')
      ).length;

      const deliveredAgain = await controlPlane.markMailboxMessageDelivered({
        teamName: 'contract-team',
        worker: 'leader-fixed',
        messageId: 'm-1',
      });
      const rawMessageCountAfter = (
        await stateStore.readMailboxMessages('contract-team', 'leader-fixed')
      ).length;

      expect(deliveredAgain.deliveredAt).toBe(delivered.deliveredAt);
      expect(rawMessageCountAfter).toBe(rawMessageCountBefore);

      const notified = await controlPlane.markMailboxMessageNotified({
        teamName: 'contract-team',
        worker: 'leader-fixed',
        messageId: 'm-1',
      });
      expect(notified.notifiedAt).toBeDefined();

      const undelivered = await controlPlane.listMailboxMessages({
        teamName: 'contract-team',
        worker: 'leader-fixed',
        includeDelivered: false,
      });

      expect(undelivered.map((message) => message.messageId)).toStrictEqual(['m-2']);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('rejects unsafe team/worker/task identifiers before state mutation', async () => {
    const tempRoot = createTempDir('omg-control-plane-identifiers-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await stateStore.writeTask('contract-team', {
        id: '1',
        subject: 'safe task',
        status: 'pending',
      });

      await expect(
        controlPlane.claimTask({
          teamName: '../contract-team',
          taskId: '1',
          worker: 'worker-1',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL}\\]`),
      );

      await expect(
        controlPlane.claimTask({
          teamName: 'contract-team',
          taskId: 'task-../1',
          worker: 'worker-1',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL}\\]`),
      );

      await expect(
        controlPlane.sendMailboxMessage({
          teamName: 'contract-team',
          fromWorker: 'worker-1',
          toWorker: 'leader-fixed/../../escape',
          body: 'blocked',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL}\\]`),
      );

      expect(await stateStore.listMailboxWorkers('contract-team')).toStrictEqual([]);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('claimTask rejects unsafe dependency identifiers from persisted task state', async () => {
    const tempRoot = createTempDir('omg-control-plane-dependency-id-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await stateStore.writeTask('contract-team', {
        id: '2',
        subject: 'unsafe dependency task',
        status: 'pending',
        dependsOn: ['../escape'],
      });

      await expect(
        controlPlane.claimTask({
          teamName: 'contract-team',
          taskId: '2',
          worker: 'worker-2',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL}\\]`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('mailbox lifecycle surfaces deterministic reason codes for invalid states', async () => {
    const tempRoot = createTempDir('omg-control-plane-mailbox-codes-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      await expect(
        controlPlane.sendMailboxMessage({
          teamName: 'contract-team',
          fromWorker: 'worker-1',
          toWorker: 'leader-fixed',
          body: '   ',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.MAILBOX_BODY_EMPTY}\\]`),
      );

      await expect(
        controlPlane.markMailboxMessageDelivered({
          teamName: 'contract-team',
          worker: 'leader-fixed',
          messageId: 'missing-message',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.MAILBOX_MESSAGE_NOT_FOUND}\\]`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('runtime code routes task writes through control-plane lifecycle module only', async () => {
    const srcRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../src',
    );
    const files = await listTypescriptFiles(srcRoot);
    const allowedWriters = new Set([
      path.resolve(srcRoot, 'team/control-plane/task-lifecycle.ts'),
      path.resolve(srcRoot, 'state/team-state-store.ts'),
    ]);
    const violations: string[] = [];

    for (const file of files) {
      if (allowedWriters.has(file)) {
        continue;
      }

      const content = await fs.readFile(file, 'utf8');
      if (content.includes('.writeTask(')) {
        violations.push(path.relative(srcRoot, file));
      }
    }

    expect(violations).toStrictEqual([]);
  });

  test('mailbox lifecycle deduplicates repeated delivery updates and prunes fully completed messages', async () => {
    const tempRoot = createTempDir('omg-control-plane-mailbox-prune-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({
        stateStore,
        now: () => new Date('2026-03-08T00:00:00.000Z'),
      });

      await controlPlane.sendMailboxMessage({
        teamName: 'contract-team',
        fromWorker: 'worker-1',
        toWorker: 'worker-2',
        messageId: 'm-1',
        body: 'ship it',
      });

      const firstDelivered = await controlPlane.markMailboxMessageDelivered({
        teamName: 'contract-team',
        worker: 'worker-2',
        messageId: 'm-1',
        at: '2026-03-08T00:01:00.000Z',
      });
      const secondDelivered = await controlPlane.markMailboxMessageDelivered({
        teamName: 'contract-team',
        worker: 'worker-2',
        messageId: 'm-1',
        at: '2026-03-08T00:02:00.000Z',
      });
      const notified = await controlPlane.markMailboxMessageNotified({
        teamName: 'contract-team',
        worker: 'worker-2',
        messageId: 'm-1',
        at: '2026-03-08T00:03:00.000Z',
      });

      expect(firstDelivered.deliveredAt).toBe('2026-03-08T00:01:00.000Z');
      expect(secondDelivered.deliveredAt).toBe('2026-03-08T00:01:00.000Z');
      expect(notified.notifiedAt).toBe('2026-03-08T00:03:00.000Z');

      const remaining = await controlPlane.listMailboxMessages({
        teamName: 'contract-team',
        worker: 'worker-2',
        includeDelivered: true,
      });
      expect(remaining).toStrictEqual([]);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('mailbox sendMessage is idempotent for duplicate message ids', async () => {
    const tempRoot = createTempDir('omg-control-plane-mailbox-idempotent-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TeamControlPlane({ stateStore });

      const first = await controlPlane.sendMailboxMessage({
        teamName: 'contract-team',
        fromWorker: 'worker-1',
        toWorker: 'worker-2',
        messageId: 'm-1',
        body: 'hello',
      });
      const second = await controlPlane.sendMailboxMessage({
        teamName: 'contract-team',
        fromWorker: 'worker-1',
        toWorker: 'worker-2',
        messageId: 'm-1',
        body: 'hello',
      });

      const messages = await controlPlane.listMailboxMessages({
        teamName: 'contract-team',
        worker: 'worker-2',
        includeDelivered: true,
      });

      expect(first.messageId).toBe('m-1');
      expect(second.messageId).toBe('m-1');
      expect(messages).toHaveLength(1);
    } finally {
      removeDir(tempRoot);
    }
  });
});
