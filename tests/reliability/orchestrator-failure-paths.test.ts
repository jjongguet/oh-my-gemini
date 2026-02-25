import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/team-state-store.js';
import { TeamOrchestrator } from '../../src/team/team-orchestrator.js';
import { RuntimeBackendRegistry } from '../../src/team/runtime/backend-registry.js';
import type { RuntimeBackend } from '../../src/team/runtime/runtime-backend.js';
import type { TeamHandle, TeamSnapshot, TeamStartInput } from '../../src/team/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

class DeterministicRuntimeBackend implements RuntimeBackend {
  readonly name = 'tmux' as const;

  startCalls = 0;
  monitorCalls = 0;
  shutdownCalls = 0;

  constructor(
    private readonly monitorFactory: (
      call: number,
      handle: TeamHandle,
    ) => TeamSnapshot | Promise<TeamSnapshot>,
    private readonly monitorErrorAtCall?: number,
  ) {}

  async probePrerequisites(_cwd: string): Promise<{ ok: boolean; issues: string[] }> {
    return {
      ok: true,
      issues: [],
    };
  }

  async startTeam(input: TeamStartInput): Promise<TeamHandle> {
    this.startCalls += 1;

    return {
      id: `handle-${this.startCalls}`,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      runtime: {
        startCall: this.startCalls,
      },
    };
  }

  async monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> {
    this.monitorCalls += 1;

    if (this.monitorErrorAtCall === this.monitorCalls) {
      throw new Error('simulated monitor crash');
    }

    return this.monitorFactory(this.monitorCalls, handle);
  }

  async shutdownTeam(): Promise<void> {
    this.shutdownCalls += 1;
  }
}

function buildRuntimeRegistry(backend: RuntimeBackend): RuntimeBackendRegistry {
  return new RuntimeBackendRegistry([backend]);
}

describe('reliability: team orchestrator failure paths', () => {
  test('fix-loop cap is enforced when monitor repeatedly reports dead worker', async () => {
    const tempRoot = createTempDir('omg-orchestrator-reliability-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const runtime = new DeterministicRuntimeBackend((_call, handle) => ({
        handleId: handle.id,
        teamName: handle.teamName,
        backend: 'tmux',
        status: 'running',
        updatedAt: new Date().toISOString(),
        workers: [
          {
            workerId: 'worker-dead',
            status: 'failed',
            lastHeartbeatAt: new Date().toISOString(),
          },
        ],
      }));
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });
      const teamName = 'reliability-fix-loop-cap';

      const result = await orchestrator.run({
        teamName,
        task: 'deterministic-failure',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 2,
      });

      expect(result.success).toBe(false);
      expect(result.phase).toBe('failed');
      expect(result.attempts).toBe(2);
      expect(result.error).toMatch(/dead workers/i);
      expect(runtime.startCalls).toBe(3);
      expect(runtime.monitorCalls).toBe(3);
      expect(runtime.shutdownCalls).toBe(3);

      const phase = await stateStore.readPhaseState(teamName);
      expect(phase?.currentPhase).toBe('failed');
      expect(phase?.currentFixAttempt).toBe(2);
      expect(phase?.transitions.some((transition) => transition.to === 'fix')).toBe(
        true,
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('persisted heartbeat+status signals are merged and can fail run as non-reporting', async () => {
    const tempRoot = createTempDir('omg-orchestrator-heartbeat-signals-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-heartbeat-signals';

      await stateStore.writeWorkerHeartbeat({
        teamName,
        workerName: 'worker-1',
        alive: true,
        pid: 101,
        turnCount: 4,
        currentTaskId: 'task-42',
        updatedAt: '2020-01-01T00:00:00.000Z',
      });
      await stateStore.writeWorkerStatus(teamName, 'worker-1', {
        state: 'in_progress',
        currentTaskId: 'task-42',
        updatedAt: '2020-01-01T00:00:00.000Z',
      });

      const runtime = new DeterministicRuntimeBackend((_call, handle) => ({
        handleId: handle.id,
        teamName: handle.teamName,
        backend: 'tmux',
        status: 'running',
        updatedAt: new Date().toISOString(),
        workers: [],
      }));
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });

      const result = await orchestrator.run({
        teamName,
        task: 'stale-heartbeat-should-fail',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
        nonReportingMs: 5_000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/non-reporting workers: worker-1/i);
      expect(result.snapshot?.workers.some((worker) => worker.workerId === 'worker-1')).toBe(
        true,
      );

      const monitorSnapshot = await stateStore.readMonitorSnapshot(teamName);
      expect(monitorSnapshot?.workers.some((worker) => worker.workerId === 'worker-1')).toBe(
        true,
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('monitor exceptions are surfaced as deterministic failed runs', async () => {
    const tempRoot = createTempDir('omg-orchestrator-monitor-error-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const runtime = new DeterministicRuntimeBackend(
        (_call, handle) => ({
          handleId: handle.id,
          teamName: handle.teamName,
          backend: 'tmux',
          status: 'running',
          updatedAt: new Date().toISOString(),
          workers: [],
        }),
        1,
      );
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });

      const result = await orchestrator.run({
        teamName: 'reliability-monitor-exception',
        task: 'simulate-monitor-exception',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/runtime monitor failed: simulated monitor crash/i);
      expect(runtime.shutdownCalls).toBe(1);
    } finally {
      removeDir(tempRoot);
    }
  });
});
