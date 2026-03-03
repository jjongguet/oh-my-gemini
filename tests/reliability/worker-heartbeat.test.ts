import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/index.js';
import { buildHeartbeatSignal } from '../../src/team/worker-signals.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: worker heartbeat signal', () => {
  test('buildHeartbeatSignal returns required fields with correct types', () => {
    const signal = buildHeartbeatSignal({
      teamName: 'my-team',
      workerName: 'worker-1',
      alive: true,
    });

    expect(signal.teamName).toBe('my-team');
    expect(signal.workerName).toBe('worker-1');
    expect(signal.alive).toBe(true);
    expect(typeof signal.updatedAt).toBe('string');
  });

  test('buildHeartbeatSignal reflects alive: false correctly', () => {
    const signal = buildHeartbeatSignal({
      teamName: 'my-team',
      workerName: 'worker-1',
      alive: false,
    });

    expect(signal.alive).toBe(false);
  });

  test('buildHeartbeatSignal includes optional fields when provided', () => {
    const signal = buildHeartbeatSignal({
      teamName: 'my-team',
      workerName: 'worker-1',
      alive: true,
      pid: 12345,
      turnCount: 7,
      currentTaskId: 'task-42',
    });

    expect(signal.pid).toBe(12345);
    expect(signal.turnCount).toBe(7);
    expect(signal.currentTaskId).toBe('task-42');
  });

  test('buildHeartbeatSignal omits optional fields when not provided', () => {
    const signal = buildHeartbeatSignal({
      teamName: 'my-team',
      workerName: 'worker-2',
      alive: true,
    });

    expect(signal.pid).toBeUndefined();
    expect(signal.turnCount).toBeUndefined();
    expect(signal.currentTaskId).toBeUndefined();
  });

  test('buildHeartbeatSignal produces a valid ISO-8601 updatedAt timestamp', () => {
    const before = Date.now();
    const signal = buildHeartbeatSignal({
      teamName: 'ts-team',
      workerName: 'worker-1',
      alive: true,
    });
    const after = Date.now();

    const parsed = new Date(signal.updatedAt).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
    // Must be a valid ISO string (Date constructor round-trips it)
    expect(new Date(signal.updatedAt).toISOString()).toBe(signal.updatedAt);
  });

  test('heartbeat signal can be persisted to and read from TeamStateStore', async () => {
    const tempRoot = createTempDir('omg-heartbeat-persist-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });

      const signal = buildHeartbeatSignal({
        teamName: 'persist-team',
        workerName: 'worker-1',
        alive: true,
        pid: 9999,
        currentTaskId: 'task-1',
      });

      await stateStore.writeWorkerHeartbeat(signal);

      const heartbeat = await stateStore.readWorkerHeartbeat('persist-team', 'worker-1');
      expect(heartbeat).not.toBeNull();
      expect(heartbeat?.alive).toBe(true);
      expect(heartbeat?.pid).toBe(9999);
      expect(heartbeat?.currentTaskId).toBe('task-1');
    } finally {
      removeDir(tempRoot);
    }
  });
});
