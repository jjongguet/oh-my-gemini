import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import {
  CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
  TeamStateStore,
} from '../../src/state/team-state-store.js';
import { TeamOrchestrator } from '../../src/team/team-orchestrator.js';
import { DEFAULT_WORKERS } from '../../src/team/constants.js';
import { RuntimeBackendRegistry } from '../../src/team/runtime/backend-registry.js';
import type { RuntimeBackend } from '../../src/team/runtime/runtime-backend.js';
import type { TeamHandle, TeamSnapshot, TeamStartInput } from '../../src/team/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

class DeterministicRuntimeBackend implements RuntimeBackend {
  readonly name: RuntimeBackend['name'];

  startCalls = 0;
  monitorCalls = 0;
  shutdownCalls = 0;
  readonly startInputs: TeamStartInput[] = [];

  constructor(
    private readonly monitorFactory: (
      call: number,
      handle: TeamHandle,
    ) => TeamSnapshot | Promise<TeamSnapshot>,
    private readonly monitorErrorAtCall?: number,
    name: RuntimeBackend['name'] = 'tmux',
  ) {
    this.name = name;
  }

  async probePrerequisites(_cwd: string): Promise<{ ok: boolean; issues: string[] }> {
    return {
      ok: true,
      issues: [],
    };
  }

  async startTeam(input: TeamStartInput): Promise<TeamHandle> {
    this.startCalls += 1;
    this.startInputs.push(input);

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

  test('success checklist fails when non-terminal tasks remain active', async () => {
    const tempRoot = createTempDir('omg-orchestrator-active-task-check-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-active-task-check';

      await stateStore.writeTask(teamName, {
        id: '1',
        subject: 'pending task',
        status: 'pending',
      });
      await stateStore.writeTask(teamName, {
        id: '2',
        subject: 'in progress task',
        status: 'in_progress',
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });
      await stateStore.writeTask(teamName, {
        id: '3',
        subject: 'blocked task',
        status: 'blocked',
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });
      await stateStore.writeTask(teamName, {
        id: '4',
        subject: 'unknown task',
        status: 'unknown',
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });

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
            status: 'done',
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
        teamName,
        task: 'fail-on-active-tasks',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });

      expect(result.success).toBe(false);
      expect(result.phase).toBe('failed');
      expect(result.error).toMatch(/non-terminal tasks remain active/i);
      // Tasks 1 and 4 are claimable (pending/unknown); pre-claim transitions both to in_progress.
      expect(result.error).toMatch(/1:in_progress/);
      expect(result.error).toMatch(/2:in_progress/);
      expect(result.error).toMatch(/3:blocked/);
      expect(result.error).toMatch(/4:in_progress/);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('pre-claim defaults to DEFAULT_WORKERS when workers input is omitted', async () => {
    const tempRoot = createTempDir('omg-orchestrator-preclaim-default-workers-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-preclaim-default-workers';

      for (let i = 1; i <= 4; i += 1) {
        await stateStore.writeTask(teamName, {
          id: String(i),
          subject: `task-${i}`,
          status: 'pending',
        });
      }

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
            status: 'done',
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
        teamName,
        task: 'preclaim-default-workers',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });

      expect(result.success).toBe(false);
      const taskClaims = runtime.startInputs[0]?.taskClaims ?? {};
      expect(Object.keys(taskClaims)).toHaveLength(DEFAULT_WORKERS);
      expect(taskClaims['worker-1']).toBeDefined();
      expect(taskClaims['worker-2']).toBeDefined();
      expect(taskClaims['worker-3']).toBeDefined();
      expect(taskClaims['worker-4']).toBeUndefined();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('pre-claim logs claim failures instead of silently swallowing them', async () => {
    const tempRoot = createTempDir('omg-orchestrator-preclaim-warning-log-');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-preclaim-warning-log';

      await stateStore.writeTask(teamName, {
        id: '0',
        subject: 'blocked by missing dep',
        status: 'pending',
        dependsOn: ['missing-task'],
      });
      await stateStore.writeTask(teamName, {
        id: '1',
        subject: 'claimable',
        status: 'pending',
      });

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
            status: 'done',
            lastHeartbeatAt: new Date().toISOString(),
          },
        ],
      }));
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
        treatRunningAsSuccess: false,
      });

      await orchestrator.run({
        teamName,
        task: 'preclaim-warning-log',
        cwd: tempRoot,
        backend: 'tmux',
        workers: 2,
        maxFixAttempts: 0,
      });

      expect(
        warnSpy.mock.calls.some(([message]) =>
          typeof message === 'string' &&
          message.includes('pre-claim skipped') &&
          message.includes(`${teamName}/worker-1`) &&
          message.includes('task 0'),
        ),
      ).toBe(true);

      const taskClaims = runtime.startInputs[0]?.taskClaims ?? {};
      expect(taskClaims['worker-1']).toBeUndefined();
      expect(taskClaims['worker-2']).toBeDefined();
    } finally {
      warnSpy.mockRestore();
      removeDir(tempRoot);
    }
  });

  test('cancelled and canceled tasks remain terminal for checklist success', async () => {
    const tempRoot = createTempDir('omg-orchestrator-cancelled-terminal-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-cancelled-terminal';

      await stateStore.writeTask(teamName, {
        id: '1',
        subject: 'completed task',
        status: 'completed',
        required: true,
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });
      await stateStore.writeTask(teamName, {
        id: '2',
        subject: 'canceled optional task',
        status: 'canceled',
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });
      await stateStore.writeTask(teamName, {
        id: '3',
        subject: 'cancelled optional task',
        status: 'cancelled',
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });

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
            status: 'done',
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
        teamName,
        task: 'cancelled-terminal-success',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('completed');
      expect(result.attempts).toBe(0);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('success checklist metadata includes task audit summary from append-only logs', async () => {
    const tempRoot = createTempDir('omg-orchestrator-task-audit-summary-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-task-audit-summary';

      await stateStore.appendTaskAuditEvent(teamName, {
        taskId: '1',
        action: 'claim',
        worker: 'worker-1',
        fromStatus: 'pending',
        toStatus: 'in_progress',
        claimTokenDigest: 'digest-1',
        reasonCode: 'OMG_CP_TASK_CLAIM_ACCEPTED',
      });

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
            status: 'done',
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
        teamName,
        task: 'task-audit-summary',
        cwd: tempRoot,
        backend: 'tmux',
        maxFixAttempts: 0,
      });

      expect(result.success).toBe(true);
      const checklist = (result.snapshot?.runtime as { successChecklist?: unknown } | undefined)
        ?.successChecklist as {
        taskAudit?: { total?: number; byAction?: { claim?: number; transition?: number } };
      } | undefined;
      expect(checklist?.taskAudit?.total).toBe(1);
      expect(checklist?.taskAudit?.byAction?.claim).toBe(1);
      expect(checklist?.taskAudit?.byAction?.transition).toBe(0);
      expect((checklist?.taskAudit as { byReasonCode?: Record<string, number> } | undefined)?.byReasonCode?.['OMG_CP_TASK_CLAIM_ACCEPTED']).toBe(1);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('subagents role output contract violations fail verify deterministically', async () => {
    const tempRoot = createTempDir('omg-orchestrator-role-contract-fail-');

    try {
      const stateRoot = path.join(tempRoot, '.omg', 'state');
      const stateStore = new TeamStateStore({ rootDir: stateRoot });
      const teamName = 'reliability-role-contract-fail';

      const runtime = new DeterministicRuntimeBackend(
        (_call, handle) => ({
          handleId: handle.id,
          teamName: handle.teamName,
          backend: 'subagents',
          status: 'completed',
          updatedAt: new Date().toISOString(),
          runtime: {
            verifyBaselinePassed: true,
            selectedSubagents: [
              {
                id: 'planner',
                role: 'planner',
                workerId: 'worker-1',
              },
            ],
            roleOutputs: [
              {
                subagentId: 'planner',
                roleId: 'planner',
                workerId: 'worker-1',
                status: 'completed',
                summary: 'planner finished',
                artifacts: {
                  json: 'virtual://team/example/roles/worker-1/planner.json',
                },
              },
            ],
          },
          workers: [
            {
              workerId: 'worker-1',
              status: 'done',
              lastHeartbeatAt: new Date().toISOString(),
            },
          ],
        }),
        undefined,
        'subagents',
      );
      const orchestrator = new TeamOrchestrator({
        stateStore,
        backends: buildRuntimeRegistry(runtime),
        treatRunningAsSuccess: false,
      });

      const result = await orchestrator.run({
        teamName,
        task: 'role-contract-failure',
        cwd: tempRoot,
        backend: 'subagents',
        maxFixAttempts: 0,
      });

      expect(result.success).toBe(false);
      expect(result.phase).toBe('failed');
      expect(result.error).toMatch(/role output contract failed/i);
      expect(result.error).toMatch(/missing plan/i);

      const checklist = (result.snapshot?.runtime as { successChecklist?: unknown } | undefined)
        ?.successChecklist as { roleContract?: { passed?: boolean } } | undefined;
      expect(checklist?.roleContract?.passed).toBe(false);
    } finally {
      removeDir(tempRoot);
    }
  });
});
