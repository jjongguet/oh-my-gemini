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
        runtime: {
          verifyBaselinePassed: true,
        },
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
        runtime: {
          verifyBaselinePassed: true,
        },
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
          runtime: {
            verifyBaselinePassed: true,
          },
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

  test('default fix-loop cap is 3 when maxFixAttempts is omitted', async () => {
    const tempRoot = createTempDir('omg-orchestrator-default-fix-cap-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const runtime = new DeterministicRuntimeBackend((_call, handle) => ({
        handleId: handle.id,
        teamName: handle.teamName,
        backend: 'tmux',
        status: 'completed',
        updatedAt: new Date().toISOString(),
        runtime: {
          verifyBaselinePassed: true,
        },
        workers: [
          {
            workerId: 'worker-1',
            status: 'failed',
            lastHeartbeatAt: new Date().toISOString(),
          },
        ],
      }));
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
        treatRunningAsSuccess: false,
      });

      const result = await orchestrator.run({
        teamName: 'reliability-default-fix-cap',
        task: 'default-cap-failure',
        cwd: tempRoot,
        backend: 'tmux',
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(runtime.startCalls).toBe(4);
      expect(runtime.monitorCalls).toBe(4);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('fix-loop cap is clamped to 3 when caller passes a higher maxFixAttempts', async () => {
    const tempRoot = createTempDir('omg-orchestrator-clamped-fix-cap-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const runtime = new DeterministicRuntimeBackend((_call, handle) => ({
        handleId: handle.id,
        teamName: handle.teamName,
        backend: 'tmux',
        status: 'completed',
        updatedAt: new Date().toISOString(),
        runtime: {
          verifyBaselinePassed: true,
        },
        workers: [
          {
            workerId: 'worker-1',
            status: 'failed',
            lastHeartbeatAt: new Date().toISOString(),
          },
        ],
      }));
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });
      const teamName = 'reliability-clamped-fix-cap';

      const result = await orchestrator.run({
        teamName,
        task: 'clamped-cap-failure',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 9,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(runtime.startCalls).toBe(4);
      expect(runtime.monitorCalls).toBe(4);

      const phase = await stateStore.readPhaseState(teamName);
      expect(phase?.maxFixAttempts).toBe(3);
      expect(phase?.currentFixAttempt).toBe(3);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('legacy running-success compatibility requires explicit env flag', async () => {
    const tempRoot = createTempDir('omg-orchestrator-legacy-running-success-');
    const previous = process.env.OMG_LEGACY_RUNNING_SUCCESS;

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const runtime = new DeterministicRuntimeBackend((_call, handle) => ({
        handleId: handle.id,
        teamName: handle.teamName,
        backend: 'tmux',
        status: 'running',
        updatedAt: new Date().toISOString(),
        runtime: {
          verifyBaselinePassed: true,
        },
        workers: [
          {
            workerId: 'worker-1',
            status: 'idle',
            lastHeartbeatAt: new Date().toISOString(),
          },
        ],
      }));

      process.env.OMG_LEGACY_RUNNING_SUCCESS = '1';
      const legacyOrchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });
      const legacyResult = await legacyOrchestrator.run({
        teamName: 'reliability-legacy-running-success',
        task: 'legacy-running-success',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });
      expect(legacyResult.success).toBe(true);
      expect(legacyResult.phase).toBe('completed');

      delete process.env.OMG_LEGACY_RUNNING_SUCCESS;
      const strictOrchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });
      const strictResult = await strictOrchestrator.run({
        teamName: 'reliability-legacy-running-success-strict',
        task: 'strict-running-failure',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });
      expect(strictResult.success).toBe(false);
      expect(strictResult.error).toMatch(/running; completed terminal status is required/i);
    } finally {
      if (previous === undefined) {
        delete process.env.OMG_LEGACY_RUNNING_SUCCESS;
      } else {
        process.env.OMG_LEGACY_RUNNING_SUCCESS = previous;
      }
      removeDir(tempRoot);
    }
  });

  test('verify gate requires explicit runtime signal unless legacy env is enabled', async () => {
    const tempRoot = createTempDir('omg-orchestrator-legacy-verify-gate-');
    const previous = process.env.OMG_LEGACY_VERIFY_GATE_PASS;

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const runtime = new DeterministicRuntimeBackend((_call, handle) => ({
        handleId: handle.id,
        teamName: handle.teamName,
        backend: 'tmux',
        status: 'completed',
        updatedAt: new Date().toISOString(),
        workers: [
          {
            workerId: 'worker-1',
            status: 'done',
            lastHeartbeatAt: new Date().toISOString(),
          },
        ],
      }));

      delete process.env.OMG_LEGACY_VERIFY_GATE_PASS;
      const strictOrchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });
      const strictResult = await strictOrchestrator.run({
        teamName: 'reliability-verify-gate-strict',
        task: 'strict-verify-gate',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });
      expect(strictResult.success).toBe(false);
      expect(strictResult.error).toMatch(/verifybaselinepassed signal is required/i);

      process.env.OMG_LEGACY_VERIFY_GATE_PASS = '1';
      const legacyOrchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
      });
      const legacyResult = await legacyOrchestrator.run({
        teamName: 'reliability-verify-gate-legacy',
        task: 'legacy-verify-gate',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });
      expect(legacyResult.success).toBe(true);
      expect(legacyResult.phase).toBe('completed');
    } finally {
      if (previous === undefined) {
        delete process.env.OMG_LEGACY_VERIFY_GATE_PASS;
      } else {
        process.env.OMG_LEGACY_VERIFY_GATE_PASS = previous;
      }
      removeDir(tempRoot);
    }
  });
});
