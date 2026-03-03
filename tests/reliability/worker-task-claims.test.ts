import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/index.js';
import { CONTROL_PLANE_FAILURE_CODES } from '../../src/team/control-plane/failure-taxonomy.js';
import { TaskControlPlane } from '../../src/team/control-plane/index.js';
import type { TaskClaimEntry } from '../../src/team/types.js';
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

      // Type-level contract: result matches TaskClaimEntry shape
      const entry: TaskClaimEntry = {
        taskId: 'task-1',
        claimToken: result.claimToken,
      };
      expect(entry.taskId).toBe('task-1');
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

  test('TaskClaimEntry type contract: taskId and claimToken are both strings', () => {
    // Type-level compile-time test: ensure the interface shape is as expected
    const entry: TaskClaimEntry = {
      taskId: 'task-abc',
      claimToken: 'token-xyz',
    };

    expect(typeof entry.taskId).toBe('string');
    expect(typeof entry.claimToken).toBe('string');
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
