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

export class TeamOrchestrator {
  private readonly stateStore: TeamStateStore;
  private readonly backends: RuntimeBackendRegistry;
  private readonly treatRunningAsSuccess: boolean;
  private readonly healthMonitorDefaults: TeamHealthMonitorOptions;

  constructor(options: TeamOrchestratorOptions = {}) {
    this.stateStore = options.stateStore ?? new TeamStateStore();
    this.backends =
      options.backends ?? createDefaultRuntimeBackendRegistry();
    this.treatRunningAsSuccess = options.treatRunningAsSuccess ?? true;
    this.healthMonitorDefaults = options.healthMonitorDefaults ?? {};
  }

  async run(input: TeamStartInput): Promise<TeamRunResult> {
    const backendName: RuntimeBackendName = input.backend ?? 'tmux';
    const runId = randomUUID();
    const maxFixAttempts = Math.max(0, input.maxFixAttempts ?? 1);

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
        error: (error as Error).message,
      });
    }

    const probe = await runtime.probePrerequisites(input.cwd);
    if (!probe.ok) {
      return this.failRun({
        backendName,
        phaseState,
        attempts: 0,
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
        error: `Failed to start team runtime: ${(error as Error).message}`,
      });
    }

    let attempts = 0;
    let snapshot: TeamSnapshot | undefined;
    const healthOptions = this.resolveHealthOptions(input);

    while (attempts <= maxFixAttempts) {
      await this.transitionPhase(
        input.teamName,
        phaseState,
        'verify',
        `Verification attempt ${attempts + 1}`,
      );

      try {
        snapshot = await runtime.monitorTeam(handle);
      } catch (error) {
        await runtime.shutdownTeam(handle, { force: true }).catch(() => undefined);
        return this.failRun({
          backendName,
          phaseState,
          attempts,
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
          error: `Failed to read worker heartbeat/status state: ${(error as Error).message}`,
          snapshot,
          handle,
        });
      }

      const health = evaluateTeamHealth(snapshot, healthOptions);

      if (!health.healthy) {
        snapshot = {
          ...snapshot,
          status: 'failed',
          failureReason: health.summary,
          summary: health.summary,
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
          error: `Failed to persist monitor snapshot: ${(error as Error).message}`,
          snapshot,
          handle,
        });
      }

      if (this.isSuccessfulSnapshot(snapshot)) {
        await this.transitionPhase(
          input.teamName,
          phaseState,
          'completed',
          'Team run verification passed.',
          {
            runtimeStatus: snapshot.status,
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

  private isSuccessfulSnapshot(snapshot: TeamSnapshot): boolean {
    if (snapshot.status === 'completed') {
      return true;
    }

    return this.treatRunningAsSuccess && snapshot.status === 'running';
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
    error: string;
    issues?: string[];
    snapshot?: TeamSnapshot;
    handle?: TeamRunResult['handle'];
  }): Promise<TeamRunResult> {
    const {
      backendName,
      phaseState,
      attempts,
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
        issues ? { issues } : undefined,
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
