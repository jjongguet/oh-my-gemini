import { randomUUID } from 'node:crypto';

import {
  TeamStateStore,
  type PersistedPhaseTransitionEvent,
  type PersistedTeamPhaseState,
  type PersistedTeamSnapshot,
  type PersistedWorkerHeartbeat,
  type PersistedWorkerStatus,
} from '../state/index.js';
import {
  DEFAULT_FIX_LOOP_CAP,
  isLegacyRunningSuccessEnabled,
  isLegacyVerifyGatePassEnabled,
} from './constants.js';
import {
  evaluateTeamHealth,
  type TeamHealthMonitorOptions,
} from './monitor.js';
import {
  createDefaultRuntimeBackendRegistry,
  type RuntimeBackendRegistry,
} from './runtime/index.js';
import type { RuntimeBackendName } from './runtime/index.js';
import type {
  TeamHandle,
  TeamLifecyclePhase,
  TeamRunResult,
  TeamSnapshot,
  TeamStartInput,
  WorkerRuntimeStatus,
  WorkerSnapshot,
} from './types.js';

export interface TeamOrchestratorOptions {
  stateStore?: TeamStateStore;
  backends?: RuntimeBackendRegistry;
  treatRunningAsSuccess?: boolean;
  healthMonitorDefaults?: TeamHealthMonitorOptions;
}

interface SuccessChecklistResult {
  ok: boolean;
  issues: string[];
  metadata: Record<string, unknown>;
}

const NON_TERMINAL_TASK_STATUSES = new Set([
  'pending',
  'in_progress',
  'blocked',
  'unknown',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class TeamOrchestrator {
  private readonly stateStore: TeamStateStore;
  private readonly backends: RuntimeBackendRegistry;
  private readonly treatRunningAsSuccess: boolean;
  private readonly healthMonitorDefaults: TeamHealthMonitorOptions;

  constructor(options: TeamOrchestratorOptions = {}) {
    this.stateStore = options.stateStore ?? new TeamStateStore();
    this.backends =
      options.backends ?? createDefaultRuntimeBackendRegistry();
    this.treatRunningAsSuccess =
      options.treatRunningAsSuccess ?? isLegacyRunningSuccessEnabled();
    this.healthMonitorDefaults = options.healthMonitorDefaults ?? {};
  }

  async run(input: TeamStartInput): Promise<TeamRunResult> {
    const backendName: RuntimeBackendName = input.backend ?? 'tmux';
    const runId = randomUUID();
    const maxFixAttempts = Math.min(
      DEFAULT_FIX_LOOP_CAP,
      Math.max(0, input.maxFixAttempts ?? DEFAULT_FIX_LOOP_CAP),
    );

    const phaseState: PersistedTeamPhaseState = {
      teamName: input.teamName,
      runId,
      currentPhase: 'plan',
      maxFixAttempts,
      currentFixAttempt: 0,
      transitions: [],
      updatedAt: new Date().toISOString(),
    };

    await this.stateStore.ensureTeamScaffold(input.teamName);
    await this.stateStore.writePhaseState(input.teamName, phaseState);

    let runtime = undefined;

    try {
      runtime = this.backends.get(backendName);
    } catch (error) {
      return this.failRun({
        backendName,
        phaseState,
        attempts: 0,
        maxFixAttempts,
        error: (error as Error).message,
      });
    }

    const probe = await runtime.probePrerequisites(input.cwd);
    if (!probe.ok) {
      return this.failRun({
        backendName,
        phaseState,
        attempts: 0,
        maxFixAttempts,
        error:
          'Runtime prerequisites failed. See issues for actionable fixes.',
        issues: probe.issues,
      });
    }

    await this.transitionPhase(
      input.teamName,
      phaseState,
      'exec',
      'Runtime prerequisites validated.',
      {
        backend: runtime.name,
      },
    );

    let handle;
    try {
      handle = await runtime.startTeam({
        ...input,
        backend: runtime.name,
      });
    } catch (error) {
      return this.failRun({
        backendName,
        phaseState,
        attempts: 0,
        maxFixAttempts,
        error: `Failed to start team runtime: ${(error as Error).message}`,
      });
    }

    let attempts = 0;
    let snapshot: TeamSnapshot | undefined;
    const healthOptions = this.resolveHealthOptions(input);

    while (attempts <= maxFixAttempts) {
      const verifyAttempt = attempts + 1;

      await this.transitionPhase(
        input.teamName,
        phaseState,
        'verify',
        `Verification attempt ${verifyAttempt}`,
        {
          attempt: verifyAttempt,
          maxFixAttempts,
        },
      );

      try {
        snapshot = await runtime.monitorTeam(handle);
      } catch (error) {
        await runtime.shutdownTeam(handle, { force: true }).catch(() => undefined);
        return this.failRun({
          backendName,
          phaseState,
          attempts,
          maxFixAttempts,
          error: `Runtime monitor failed: ${(error as Error).message}`,
          handle,
        });
      }

      try {
        snapshot = await this.enrichSnapshotWithPersistedWorkerSignals(
          input.teamName,
          snapshot,
        );
      } catch (error) {
        await runtime.shutdownTeam(handle, { force: true }).catch(() => undefined);
        return this.failRun({
          backendName,
          phaseState,
          attempts,
          maxFixAttempts,
          error: `Failed to read worker heartbeat/status state: ${(error as Error).message}`,
          snapshot,
          handle,
        });
      }

      const health = evaluateTeamHealth(snapshot, healthOptions);
      const checklist = await this.evaluateSuccessChecklist(
        input.teamName,
        snapshot,
        health,
      );

      if (!checklist.ok) {
        snapshot = {
          ...snapshot,
          status: 'failed',
          failureReason: checklist.issues.join(' | '),
          summary: checklist.issues.join(' | '),
          runtime: {
            ...(snapshot.runtime ?? {}),
            successChecklist: checklist.metadata,
          },
        };
      } else {
        snapshot = {
          ...snapshot,
          runtime: {
            ...(snapshot.runtime ?? {}),
            successChecklist: checklist.metadata,
          },
        };
      }

      try {
        await this.persistSnapshot(runId, snapshot);
      } catch (error) {
        await runtime.shutdownTeam(handle, { force: true }).catch(() => undefined);
        return this.failRun({
          backendName,
          phaseState,
          attempts,
          maxFixAttempts,
          error: `Failed to persist monitor snapshot: ${(error as Error).message}`,
          snapshot,
          handle,
        });
      }

      if (checklist.ok) {
        await this.transitionPhase(
          input.teamName,
          phaseState,
          'completed',
          'Team run verification passed.',
          {
            attempt: verifyAttempt,
            maxFixAttempts,
            runtimeStatus: snapshot.status,
            legacyRunningSuccess: this.treatRunningAsSuccess && snapshot.status === 'running',
            checklist: checklist.metadata,
          },
        );

        return {
          success: true,
          status: 'completed',
          phase: 'completed',
          attempts,
          backend: runtime.name,
          handle,
          snapshot,
        };
      }

      if (attempts >= maxFixAttempts) {
        break;
      }

      attempts += 1;
      phaseState.currentFixAttempt = attempts;

      await this.transitionPhase(
        input.teamName,
        phaseState,
        'fix',
        `Fix attempt ${attempts} of ${maxFixAttempts}`,
        {
          attempt: attempts,
          maxFixAttempts,
          runtimeStatus: snapshot.status,
          failureReason: snapshot.failureReason,
        },
      );

      await runtime.shutdownTeam(handle, { force: true }).catch(() => undefined);

      await this.transitionPhase(
        input.teamName,
        phaseState,
        'exec',
        `Restarting runtime after fix attempt ${attempts}`,
        {
          attempt: attempts,
          maxFixAttempts,
        },
      );

      try {
        handle = await runtime.startTeam({
          ...input,
          backend: runtime.name,
        });
      } catch (error) {
        return this.failRun({
          backendName,
          phaseState,
          attempts,
          maxFixAttempts,
          error: `Runtime restart failed: ${(error as Error).message}`,
          snapshot,
          handle,
        });
      }
    }

    await runtime.shutdownTeam(handle, { force: true }).catch(() => undefined);

    return this.failRun({
      backendName,
      phaseState,
      attempts,
      maxFixAttempts,
      error:
        snapshot?.failureReason ||
        `Verification failed after ${attempts} fix attempt(s).`,
      snapshot,
      handle,
    });
  }

  async shutdown(handle: TeamHandle, force = true): Promise<void> {
    const backend = this.backends.get(handle.backend);
    await backend.shutdownTeam(handle, { force });
  }

  private async evaluateSuccessChecklist(
    teamName: string,
    snapshot: TeamSnapshot,
    health: ReturnType<typeof evaluateTeamHealth>,
  ): Promise<SuccessChecklistResult> {
    const issues: string[] = [];

    if (!health.healthy) {
      issues.push(health.summary);
    }

    if (snapshot.status === 'running' && !this.treatRunningAsSuccess) {
      issues.push(
        'runtime status is running; completed terminal status is required (set OMG_LEGACY_RUNNING_SUCCESS=1 only for temporary compatibility)',
      );
    }

    if (snapshot.status !== 'completed' && snapshot.status !== 'running') {
      issues.push(`runtime status is ${snapshot.status}; completed terminal status is required`);
    }

    const verifyGate = readVerifyGateFromSnapshot(snapshot);
    if (!verifyGate.passed) {
      issues.push(verifyGate.reason);
    }

    const tasks = await this.stateStore.listTasks(teamName);
    const requiredTasks = tasks.filter((task) => task.required);
    const failedTasks = tasks.filter((task) => task.status === 'failed');
    const incompleteRequiredTasks = requiredTasks.filter((task) => task.status !== 'completed');
    const activeNonTerminalTasks = tasks.filter((task) =>
      NON_TERMINAL_TASK_STATUSES.has(task.status),
    );

    if (failedTasks.length > 0) {
      issues.push(`failed tasks present: ${failedTasks.map((task) => task.id).join(', ')}`);
    }

    if (incompleteRequiredTasks.length > 0) {
      issues.push(
        `required tasks not completed: ${incompleteRequiredTasks
          .map((task) => `${task.id}:${task.status}`)
          .join(', ')}`,
      );
    }

    if (activeNonTerminalTasks.length > 0) {
      issues.push(
        `non-terminal tasks remain active: ${activeNonTerminalTasks
          .map((task) => `${task.id}:${task.status}`)
          .join(', ')}`,
      );
    }

    return {
      ok: issues.length === 0,
      issues,
      metadata: {
        runtimeStatus: snapshot.status,
        treatRunningAsSuccess: this.treatRunningAsSuccess,
        verifyGate,
        taskCounts: {
          total: tasks.length,
          required: requiredTasks.length,
          failed: failedTasks.length,
          incompleteRequired: incompleteRequiredTasks.length,
          activeNonTerminal: activeNonTerminalTasks.length,
        },
        health: {
          healthy: health.healthy,
          deadWorkers: health.deadWorkers,
          nonReportingWorkers: health.nonReportingWorkers,
          watchdogExpired: health.watchdogExpired,
        },
      },
    };
  }

  private async persistSnapshot(
    runId: string,
    snapshot: TeamSnapshot,
  ): Promise<void> {
    const persistedSnapshot: PersistedTeamSnapshot = {
      runId,
      teamName: snapshot.teamName,
      handleId: snapshot.handleId,
      backend: snapshot.backend,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      workers: snapshot.workers,
      summary: snapshot.summary,
      failureReason: snapshot.failureReason,
      runtime: snapshot.runtime,
    };

    await this.stateStore.writeMonitorSnapshot(snapshot.teamName, persistedSnapshot);
  }

  private resolveHealthOptions(input: TeamStartInput): TeamHealthMonitorOptions {
    return {
      watchdogMs:
        input.watchdogMs ??
        this.healthMonitorDefaults.watchdogMs ??
        readDurationFromEnv('OMG_TEAM_WATCHDOG_MS'),
      nonReportingMs:
        input.nonReportingMs ??
        this.healthMonitorDefaults.nonReportingMs ??
        readDurationFromEnv('OMG_TEAM_NON_REPORTING_MS'),
    };
  }

  private async enrichSnapshotWithPersistedWorkerSignals(
    teamName: string,
    snapshot: TeamSnapshot,
  ): Promise<TeamSnapshot> {
    const [heartbeats, statuses] = await Promise.all([
      this.stateStore.readAllWorkerHeartbeats(teamName),
      this.stateStore.readAllWorkerStatuses(teamName),
    ]);

    const signalWorkerNames = new Set([
      ...Object.keys(heartbeats),
      ...Object.keys(statuses),
    ]);

    if (signalWorkerNames.size === 0) {
      return snapshot;
    }

    const workersById = new Map<string, WorkerSnapshot>(
      snapshot.workers.map((worker) => [worker.workerId, worker]),
    );

    for (const workerName of [...signalWorkerNames].sort((a, b) => a.localeCompare(b))) {
      const existing = workersById.get(workerName);
      const heartbeat = heartbeats[workerName];
      const status = statuses[workerName];
      const resolvedStatus = resolveWorkerRuntimeStatus(
        existing?.status,
        status,
        heartbeat,
      );
      const mergedDetails = mergeWorkerDetails(existing?.details, heartbeat, status);

      workersById.set(workerName, {
        workerId: workerName,
        status: resolvedStatus,
        lastHeartbeatAt:
          heartbeat?.updatedAt ?? existing?.lastHeartbeatAt,
        details: mergedDetails,
      });
    }

    return {
      ...snapshot,
      workers: [...workersById.values()],
    };
  }

  private async transitionPhase(
    teamName: string,
    phaseState: PersistedTeamPhaseState,
    to: TeamLifecyclePhase,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const transition: PersistedPhaseTransitionEvent = {
      teamName,
      runId: phaseState.runId,
      from: phaseState.currentPhase,
      to,
      at: new Date().toISOString(),
      reason,
      metadata,
    };

    phaseState.currentPhase = to;
    phaseState.updatedAt = transition.at;
    phaseState.transitions.push(transition);

    await this.stateStore.writePhaseState(teamName, phaseState);
    await this.stateStore.appendPhaseTransition(teamName, transition);
  }

  private async failRun(params: {
    backendName: RuntimeBackendName;
    phaseState: PersistedTeamPhaseState;
    attempts: number;
    maxFixAttempts: number;
    error: string;
    issues?: string[];
    snapshot?: TeamSnapshot;
    handle?: TeamRunResult['handle'];
  }): Promise<TeamRunResult> {
    const {
      backendName,
      phaseState,
      attempts,
      maxFixAttempts,
      error,
      issues,
      snapshot,
      handle,
    } = params;

    phaseState.lastError = error;

    if (phaseState.currentPhase !== 'failed') {
      await this.transitionPhase(
        phaseState.teamName,
        phaseState,
        'failed',
        error,
        {
          issues,
          attempts,
          maxFixAttempts,
        },
      );
    } else {
      phaseState.updatedAt = new Date().toISOString();
      await this.stateStore.writePhaseState(phaseState.teamName, phaseState);
    }

    return {
      success: false,
      status: 'failed',
      phase: 'failed',
      attempts,
      backend: backendName,
      error,
      issues,
      snapshot,
      handle,
    };
  }
}

function readDurationFromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function resolveWorkerRuntimeStatus(
  fallback: WorkerRuntimeStatus | undefined,
  status: PersistedWorkerStatus | undefined,
  heartbeat: PersistedWorkerHeartbeat | undefined,
): WorkerRuntimeStatus {
  if (heartbeat?.alive === false) {
    return 'failed';
  }

  switch (status?.state) {
    case 'idle':
      return 'idle';
    case 'in_progress':
      return 'running';
    case 'blocked':
      return 'blocked';
    case 'failed':
      return 'failed';
    case 'unknown':
      return 'unknown';
    default:
      return fallback ?? 'unknown';
  }
}

function mergeWorkerDetails(
  fallback: string | undefined,
  heartbeat: PersistedWorkerHeartbeat | undefined,
  status: PersistedWorkerStatus | undefined,
): string | undefined {
  const detailParts: string[] = [];

  if (fallback) {
    detailParts.push(fallback);
  }

  if (status?.reason) {
    detailParts.push(`reason=${status.reason}`);
  }

  if (typeof heartbeat?.pid === 'number') {
    detailParts.push(`pid=${heartbeat.pid}`);
  }

  if (typeof heartbeat?.turnCount === 'number') {
    detailParts.push(`turns=${heartbeat.turnCount}`);
  }

  if (heartbeat?.currentTaskId) {
    detailParts.push(`task=${heartbeat.currentTaskId}`);
  } else if (status?.currentTaskId) {
    detailParts.push(`task=${status.currentTaskId}`);
  }

  if (heartbeat?.alive === false) {
    detailParts.push('heartbeat=dead');
  }

  return detailParts.length > 0 ? detailParts.join(' | ') : undefined;
}

function readVerifyGateFromSnapshot(
  snapshot: TeamSnapshot,
): {
  passed: boolean;
  reason: string;
} {
  const legacyVerifyGatePass = isLegacyVerifyGatePassEnabled();

  if (!isRecord(snapshot.runtime)) {
    if (legacyVerifyGatePass) {
      return {
        passed: true,
        reason:
          'verify baseline status unavailable; treated as pass because OMG_LEGACY_VERIFY_GATE_PASS=1',
      };
    }
    return {
      passed: false,
      reason:
        'verify baseline status unavailable; explicit verifyBaselinePassed signal is required',
    };
  }

  const runtime = snapshot.runtime;
  const verifyBaselinePassed = runtime.verifyBaselinePassed;

  if (typeof verifyBaselinePassed !== 'boolean') {
    if (legacyVerifyGatePass) {
      return {
        passed: true,
        reason:
          'verify baseline status unavailable; treated as pass because OMG_LEGACY_VERIFY_GATE_PASS=1',
      };
    }
    return {
      passed: false,
      reason:
        'verify baseline status unavailable; explicit verifyBaselinePassed signal is required',
    };
  }

  if (verifyBaselinePassed) {
    return {
      passed: true,
      reason: 'verify baseline passed',
    };
  }

  return {
    passed: false,
    reason: 'verify baseline did not pass',
  };
}
