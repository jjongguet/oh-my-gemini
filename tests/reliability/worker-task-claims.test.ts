import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/index.js';
import { CONTROL_PLANE_FAILURE_CODES } from '../../src/team/control-plane/failure-taxonomy.js';
import { TaskControlPlane } from '../../src/team/control-plane/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: worker task claims (orchestrator pre-assignment)', () => {
  test('orchestrator can pre-claim a pending task and receive a token', async () => {
    const tempRoot = createTempDir('omg-preclaim-basic-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('alpha-team', {
        id: 'task-1',
        subject: 'implement feature A',
        status: 'pending',
      });

      const result = await controlPlane.claimTask({
        teamName: 'alpha-team',
        taskId: 'task-1',
        worker: 'worker-1',
      });

      expect(result.claimToken).toBeTruthy();
      expect(result.task.status).toBe('in_progress');
      expect(result.task.owner).toBe('worker-1');

      // Claim token must also be persisted on the task for later transitions/releases.
      const persisted = await stateStore.readTask('alpha-team', 'task-1');
      expect(persisted).not.toBeNull();
      expect(persisted?.claim?.owner).toBe('worker-1');
      expect(persisted?.claim?.token).toBe(result.claimToken);
      expect(persisted?.claim?.leasedUntil).toBeTruthy();
      expect(new Date(persisted?.claim?.leasedUntil ?? '').toISOString()).toBe(
        persisted?.claim?.leasedUntil,
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('double-claim on same task is rejected with TASK_ALREADY_CLAIMED', async () => {
    const tempRoot = createTempDir('omg-preclaim-double-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('alpha-team', {
        id: 'task-1',
        subject: 'task',
        status: 'pending',
      });

      await controlPlane.claimTask({
        teamName: 'alpha-team',
        taskId: 'task-1',
        worker: 'worker-1',
      });

      await expect(
        controlPlane.claimTask({
          teamName: 'alpha-team',
          taskId: 'task-1',
          worker: 'worker-2',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_ALREADY_CLAIMED}\\]`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('transitionTaskStatus with correct pre-issued token completes the task', async () => {
    const tempRoot = createTempDir('omg-preclaim-transition-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('beta-team', {
        id: 'task-2',
        subject: 'write tests',
        status: 'pending',
      });

      const { claimToken } = await controlPlane.claimTask({
        teamName: 'beta-team',
        taskId: 'task-2',
        worker: 'worker-1',
      });

      // Simulate worker completing via env-injected token
      const completed = await controlPlane.transitionTaskStatus({
        teamName: 'beta-team',
        taskId: 'task-2',
        worker: 'worker-1',
        claimToken,
        from: 'in_progress',
        to: 'completed',
        result: 'all tests written',
      });

      expect(completed.status).toBe('completed');
      expect(completed.claim).toBeUndefined();
      expect(completed.result).toBe('all tests written');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('transitionTaskStatus with wrong token is rejected with TOKEN_MISMATCH', async () => {
    const tempRoot = createTempDir('omg-preclaim-wrong-token-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('gamma-team', {
        id: 'task-3',
        subject: 'deploy service',
        status: 'pending',
      });

      await controlPlane.claimTask({
        teamName: 'gamma-team',
        taskId: 'task-3',
        worker: 'worker-1',
      });

      await expect(
        controlPlane.transitionTaskStatus({
          teamName: 'gamma-team',
          taskId: 'task-3',
          worker: 'worker-1',
          claimToken: 'bad-token-injected-by-attacker',
          from: 'in_progress',
          to: 'completed',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_TOKEN_MISMATCH}\\]`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('task with unresolved dependencies cannot be claimed', async () => {
    const tempRoot = createTempDir('omg-preclaim-deps-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('delta-team', {
        id: 'dep-task',
        subject: 'prerequisite',
        status: 'pending',
      });
      await stateStore.writeTask('delta-team', {
        id: 'blocked-task',
        subject: 'blocked on dep',
        status: 'pending',
        dependsOn: ['dep-task'],
      });

      await expect(
        controlPlane.claimTask({
          teamName: 'delta-team',
          taskId: 'blocked-task',
          worker: 'worker-1',
        }),
      ).rejects.toThrow(
        new RegExp(`\\[${CONTROL_PLANE_FAILURE_CODES.TASK_DEPENDENCIES_UNRESOLVED}\\]`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('successful claims for different tasks produce distinct claim tokens', async () => {
    const tempRoot = createTempDir('omg-preclaim-unique-tokens-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('zeta-team', {
        id: 'task-a',
        subject: 'task A',
        status: 'pending',
      });
      await stateStore.writeTask('zeta-team', {
        id: 'task-b',
        subject: 'task B',
        status: 'pending',
      });

      const first = await controlPlane.claimTask({
        teamName: 'zeta-team',
        taskId: 'task-a',
        worker: 'worker-1',
      });
      const second = await controlPlane.claimTask({
        teamName: 'zeta-team',
        taskId: 'task-b',
        worker: 'worker-1',
      });

      expect(first.claimToken).not.toBe(second.claimToken);
      expect(first.task.claim?.token).toBe(first.claimToken);
      expect(second.task.claim?.token).toBe(second.claimToken);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('same worker re-claim is idempotent and reuses existing claim token', async () => {
    const tempRoot = createTempDir('omg-preclaim-idempotent-reclaim-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('theta-team', {
        id: 'task-idem',
        subject: 'idempotent reclaim',
        status: 'pending',
      });

      const first = await controlPlane.claimTask({
        teamName: 'theta-team',
        taskId: 'task-idem',
        worker: 'worker-1',
      });

      const second = await controlPlane.claimTask({
        teamName: 'theta-team',
        taskId: 'task-idem',
        worker: 'worker-1',
      });

      expect(second.claimToken).toBe(first.claimToken);
      expect(second.task.claim?.token).toBe(first.claimToken);
      expect(second.task.owner).toBe('worker-1');
      expect(second.task.status).toBe('in_progress');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('releaseTaskClaim returns task to pending and clears ownership', async () => {
    const tempRoot = createTempDir('omg-preclaim-release-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const controlPlane = new TaskControlPlane({ stateStore });

      await stateStore.writeTask('epsilon-team', {
        id: 'task-r',
        subject: 'releasable task',
        status: 'pending',
      });

      const { claimToken } = await controlPlane.claimTask({
        teamName: 'epsilon-team',
        taskId: 'task-r',
        worker: 'worker-1',
      });

      const released = await controlPlane.releaseTaskClaim({
        teamName: 'epsilon-team',
        taskId: 'task-r',
        worker: 'worker-1',
        claimToken,
      });

      expect(released.status).toBe('pending');
      expect(released.claim).toBeUndefined();
      expect(released.owner).toBeUndefined();
    } finally {
      removeDir(tempRoot);
    }
  });
});
