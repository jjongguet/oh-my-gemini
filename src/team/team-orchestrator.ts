import { randomUUID } from 'node:crypto';

import {
  TeamStateStore,
  type PersistedTaskAuditEvent,
  type PersistedPhaseTransitionEvent,
  type PersistedTeamPhaseState,
  type PersistedTeamSnapshot,
  type PersistedWorkerDoneSignal,
  type PersistedWorkerHeartbeat,
  type PersistedWorkerStatus,
} from '../state/index.js';
import {
  DEFAULT_FIX_LOOP_CAP,
  DEFAULT_WORKERS,
  buildLegacyRunningSuccessAuditRecord,
  buildLegacyVerifyGatePassAuditRecord,
  type LegacyBypassAuditRecord,
  emitLegacyBypassAuditLogs,
  isLegacyRunningSuccessEnabled,
  isLegacyVerifyGatePassEnabled,
} from './constants.js';
import {
  evaluateTeamHealth,
  type TeamHealthMonitorOptions,
} from './monitor.js';
import { evaluateRoleOutputContract } from './role-output-contract.js';
import { evaluatePrdAcceptanceContract } from '../prd/index.js';
import {
  createDefaultRuntimeBackendRegistry,
  type RuntimeBackendRegistry,
} from './runtime/index.js';
import type { RuntimeBackendName } from './runtime/index.js';
import type {
  TaskClaimEntry,
  TeamHandle,
  TeamLifecyclePhase,
  TeamRunResult,
  TeamSnapshot,
  TeamStartInput,
  WorkerRuntimeStatus,
  WorkerSnapshot,
} from './types.js';
import { writeWorkerContext } from '../hooks/index.js';
import { TaskControlPlane } from './control-plane/index.js';

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

interface TaskAuditSummary {
  total: number;
  byAction: Record<'claim' | 'transition' | 'release', number>;
  byTask: Record<string, number>;
  byReasonCode: Record<string, number>;
  latestAt?: string;
}

interface PersistedRunInputMetadata {
  version: number;
  task: string;
  cwd: string;
  backend: RuntimeBackendName;
  workers?: number;
  subagents?: string[];
  maxFixLoop: number;
  watchdogMs?: number;
  nonReportingMs?: number;
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

    emitLegacyBypassAuditLogs({ scope: 'team-orchestrator' });
  }

  async run(input: TeamStartInput): Promise<TeamRunResult> {
    const backendName: RuntimeBackendName = input.backend ?? 'tmux';
    const runId = randomUUID();
    const maxFixAttempts = Math.min(
      DEFAULT_FIX_LOOP_CAP,
      Math.max(0, input.maxFixAttempts ?? DEFAULT_FIX_LOOP_CAP),
    );
    const runInputMetadata = buildRunInputMetadata({
      ...input,
      backend: backendName,
      maxFixAttempts,
    });

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

    try {
      await writeWorkerContext(input);
    } catch (error) {
      return this.failRun({
        backendName,
        phaseState,
        attempts: 0,
        maxFixAttempts,
        error: `Failed to write worker context: ${(error as Error).message}`,
      });
    }

    let handle;
    try {
      const taskClaims = await this.preClaimTasksForWorkers(
        input.teamName,
        input.workers ?? DEFAULT_WORKERS,
      );
      handle = await runtime.startTeam({
        ...input,
        backend: runtime.name,
        taskClaims,
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
    const resolvedPollTimeoutMs =
      readDurationFromEnv('OMG_TEAM_POLL_TIMEOUT_MS') ?? 600_000;

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
        snapshot = await this.awaitWorkerCompletion(
          runtime,
          handle,
          2000,
          resolvedPollTimeoutMs,
        );
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

      snapshot = attachRunInputMetadata(snapshot, runInputMetadata);

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
        await writeWorkerContext(input);
      } catch (error) {
        return this.failRun({
          backendName,
          phaseState,
          attempts,
          maxFixAttempts,
          error: `Failed to write worker context on restart: ${(error as Error).message}`,
          snapshot,
          handle,
        });
      }

      try {
        const taskClaims = await this.preClaimTasksForWorkers(
          input.teamName,
          input.workers ?? DEFAULT_WORKERS,
        );
        handle = await runtime.startTeam({
          ...input,
          backend: runtime.name,
          taskClaims,
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
    const legacyBypassAudit: LegacyBypassAuditRecord[] = [];

    if (!health.healthy) {
      issues.push(health.summary);
    }

    if (snapshot.status === 'running' && this.treatRunningAsSuccess) {
      legacyBypassAudit.push(buildLegacyRunningSuccessAuditRecord(
        'success-checklist.runtime-status-running',
      ));
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
    if (verifyGate.auditRecord) {
      legacyBypassAudit.push(verifyGate.auditRecord);
    }
    if (!verifyGate.passed) {
      issues.push(verifyGate.reason);
    }

    const roleContract = evaluateRoleOutputContract(snapshot, {
      requireArtifactEvidence: true,
      cwd: readRoleOutputEvidenceCwd(snapshot),
      teamName,
    });
    if (roleContract.applicable && !roleContract.passed) {
      issues.push(roleContract.summary);
    }

    const prdContract = evaluatePrdAcceptanceContract(snapshot.runtime);
    if (prdContract.applicable && !prdContract.passed) {
      issues.push(prdContract.summary);
    }

    const tasks = await this.stateStore.listTasks(teamName);
    const taskAuditSummary = summarizeTaskAuditEvents(
      await this.stateStore.readTaskAuditEvents(teamName),
    );
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
        roleContract: {
          passed: roleContract.passed,
          summary: roleContract.summary,
          issues: roleContract.issues,
          ...roleContract.metadata,
        },
        prdContract: {
          passed: prdContract.passed,
          summary: prdContract.summary,
          issues: prdContract.issues,
          ...prdContract.metadata,
        },
        taskCounts: {
          total: tasks.length,
          required: requiredTasks.length,
          failed: failedTasks.length,
          incompleteRequired: incompleteRequiredTasks.length,
          activeNonTerminal: activeNonTerminalTasks.length,
        },
        taskAudit: taskAuditSummary,
        health: {
          healthy: health.healthy,
          deadWorkers: health.deadWorkers,
          nonReportingWorkers: health.nonReportingWorkers,
          watchdogExpired: health.watchdogExpired,
        },
        legacyBypassAudit,
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
    const [heartbeats, statuses, doneSignals] = await Promise.all([
      this.stateStore.readAllWorkerHeartbeats(teamName),
      this.stateStore.readAllWorkerStatuses(teamName),
      this.stateStore.readAllWorkerDoneSignals(teamName),
    ]);

    const signalWorkerNames = new Set([
      ...Object.keys(heartbeats),
      ...Object.keys(statuses),
      ...Object.keys(doneSignals),
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
      const doneSignal = doneSignals[workerName];

      // Done signal takes highest priority over heartbeat/status
      let resolvedStatus: WorkerRuntimeStatus;
      if (doneSignal) {
        resolvedStatus = doneSignal.status === 'completed' ? 'done' : 'failed';
      } else {
        resolvedStatus = resolveWorkerRuntimeStatus(existing?.status, status, heartbeat);
      }

      const mergedDetails = mergeWorkerDetails(existing?.details, heartbeat, status);
      const doneDetails = doneSignal
        ? `done_signal=${doneSignal.status}${doneSignal.summary ? `,summary=${doneSignal.summary}` : ''}`
        : undefined;

      workersById.set(workerName, {
        workerId: workerName,
        status: resolvedStatus,
        lastHeartbeatAt:
          heartbeat?.updatedAt ?? existing?.lastHeartbeatAt,
        details: [mergedDetails, doneDetails].filter(Boolean).join(' | ') || undefined,
      });
    }

    return {
      ...snapshot,
      workers: [...workersById.values()],
    };
  }

  private async awaitWorkerCompletion(
    runtime: { monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> },
    handle: TeamHandle,
    pollIntervalMs = 2000,
    timeoutMs = 600_000,
  ): Promise<TeamSnapshot> {
    const deadline = Date.now() + timeoutMs;
    let snapshot = await runtime.monitorTeam(handle);
    let hasObservedActivity = false;
    let timedOut = true;

    while (Date.now() < deadline) {
      const isTerminal =
        snapshot.status === 'completed' ||
        snapshot.status === 'failed' ||
        snapshot.status === 'stopped';

      if (
        !hasObservedActivity &&
        snapshot.workers.some(
          (w) =>
            w.status === 'running' ||
            w.status === 'blocked' ||
            w.status === 'done' ||
            w.status === 'failed',
        )
      ) {
        hasObservedActivity = true;
      }

      // Preserve empty-worker short-circuit behavior for non-reporting detection,
      // but avoid treating all-idle/all-unknown snapshots as completion until
      // we've seen active/terminal worker activity in this run.
      const noActiveWorkers =
        snapshot.workers.length === 0 ||
        (hasObservedActivity &&
          snapshot.workers.every(
            (w) =>
              w.status === 'done' ||
              w.status === 'failed' ||
              w.status === 'idle' ||
              w.status === 'unknown',
          ));

      if (isTerminal || noActiveWorkers) {
        timedOut = false;
        break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
      snapshot = await runtime.monitorTeam(handle);
    }

    if (timedOut && !hasObservedActivity) {
      console.warn(
        '[awaitWorkerCompletion] Poll timeout reached without observing any worker activity. Workers may have failed to spawn.',
      );
    }

    return snapshot;
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

  private async preClaimTasksForWorkers(
    teamName: string,
    workerCount: number,
  ): Promise<Record<string, TaskClaimEntry>> {
    const tasks = await this.stateStore.listTasks(teamName).catch(() => []);
    const claimable = tasks.filter(
      (t) => t.status === 'pending' || t.status === 'unknown',
    );

    if (claimable.length === 0) {
      return {};
    }

    const controlPlane = new TaskControlPlane({ stateStore: this.stateStore });
    const claims: Record<string, TaskClaimEntry> = {};

    for (let i = 0; i < Math.min(claimable.length, workerCount); i++) {
      const workerId = `worker-${i + 1}`;
      const task = claimable[i];
      if (!task) continue;
      try {
        const result = await controlPlane.claimTask({
          teamName,
          taskId: task.id,
          worker: workerId,
        });
        claims[workerId] = { taskId: task.id, claimToken: result.claimToken };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `[team-orchestrator] pre-claim skipped for ${teamName}/${workerId} task ${task.id}: ${reason}`,
        );
      }
    }

    return claims;
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

function summarizeTaskAuditEvents(events: PersistedTaskAuditEvent[]): TaskAuditSummary {
  const byAction: TaskAuditSummary['byAction'] = {
    claim: 0,
    transition: 0,
    release: 0,
  };
  const byTask: Record<string, number> = {};
  const byReasonCode: Record<string, number> = {};
  let latestAt: string | undefined;

  for (const event of events) {
    byAction[event.action] += 1;
    byTask[event.taskId] = (byTask[event.taskId] ?? 0) + 1;
    const reasonCode = event.reasonCode ?? event.reason_code;
    if (reasonCode) {
      byReasonCode[reasonCode] = (byReasonCode[reasonCode] ?? 0) + 1;
    }
    if (!latestAt || event.at > latestAt) {
      latestAt = event.at;
    }
  }

  return {
    total: events.length,
    byAction,
    byTask,
    byReasonCode,
    latestAt,
  };
}

function buildRunInputMetadata(input: TeamStartInput): PersistedRunInputMetadata {
  return {
    version: 1,
    task: input.task,
    cwd: input.cwd,
    backend: input.backend ?? 'tmux',
    workers:
      typeof input.workers === 'number' && Number.isInteger(input.workers)
        ? input.workers
        : undefined,
    subagents:
      Array.isArray(input.subagents) && input.subagents.length > 0
        ? [...input.subagents]
        : undefined,
    maxFixLoop: input.maxFixAttempts ?? DEFAULT_FIX_LOOP_CAP,
    watchdogMs:
      typeof input.watchdogMs === 'number' && Number.isInteger(input.watchdogMs)
        ? input.watchdogMs
        : undefined,
    nonReportingMs:
      typeof input.nonReportingMs === 'number' &&
      Number.isInteger(input.nonReportingMs)
        ? input.nonReportingMs
        : undefined,
  };
}

function attachRunInputMetadata(
  snapshot: TeamSnapshot,
  runInput: PersistedRunInputMetadata,
): TeamSnapshot {
  const runtime = isRecord(snapshot.runtime) ? snapshot.runtime : {};
  return {
    ...snapshot,
    runtime: {
      ...runtime,
      runInput,
    },
  };
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

function readRoleOutputEvidenceCwd(snapshot: TeamSnapshot): string | undefined {
  if (!isRecord(snapshot.runtime)) {
    return undefined;
  }

  const runInput = snapshot.runtime.runInput;
  if (isRecord(runInput)) {
    const runInputCwd = typeof runInput.cwd === 'string' ? runInput.cwd.trim() : '';
    if (runInputCwd) {
      return runInputCwd;
    }
  }

  const runtimeCwd =
    typeof snapshot.runtime.cwd === 'string' ? snapshot.runtime.cwd.trim() : '';
  return runtimeCwd || undefined;
}

function readVerifyGateFromSnapshot(
  snapshot: TeamSnapshot,
): {
  passed: boolean;
  reason: string;
  auditRecord?: LegacyBypassAuditRecord;
} {
  const legacyVerifyGatePass = isLegacyVerifyGatePassEnabled();

  if (!isRecord(snapshot.runtime)) {
    if (legacyVerifyGatePass) {
      return {
        passed: true,
        reason:
          'verify baseline status unavailable; treated as pass because OMG_LEGACY_VERIFY_GATE_PASS=1 (deprecated compatibility bypass)',
        auditRecord: buildLegacyVerifyGatePassAuditRecord(
          'verify-gate.runtime-missing',
        ),
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
          'verify baseline status unavailable; treated as pass because OMG_LEGACY_VERIFY_GATE_PASS=1 (deprecated compatibility bypass)',
        auditRecord: buildLegacyVerifyGatePassAuditRecord(
          'verify-gate.runtime-missing',
        ),
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
