import {
  type PersistedTaskAuditEvent,
  type PersistedTeamSnapshot,
  TeamStateStore,
  type PersistedTaskRecord,
  type PersistedWorkerHeartbeat,
  type PersistedWorkerStatus,
} from '../../state/index.js';
import { CLI_USAGE_EXIT_CODE } from '../../team/constants.js';
import { evaluateTeamHealth } from '../../team/monitor.js';
import type {
  TeamRuntimeStatus,
  TeamSnapshot,
  WorkerRuntimeStatus,
  WorkerSnapshot,
} from '../../team/types.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';
import { normalizeTeamName } from './team-command-shared.js';

export interface TeamStatusInput {
  teamName: string;
  cwd: string;
}

export interface TeamStatusOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface TeamStatusCommandContext {
  io: CliIo;
  cwd: string;
  statusRunner?: (input: TeamStatusInput) => Promise<TeamStatusOutput>;
  teamStatusRunner?: (input: TeamStatusInput) => Promise<TeamStatusOutput>;
}

function printTeamStatusHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg team status [--team <name>] [--json]',
    '',
    'Options:',
    '  --team <name>   Team state namespace (default: oh-my-gemini)',
    '  --json          Print machine-readable output',
    '  --help          Show command help',
  ].join('\n'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizePersistedWorkerRuntimeStatus(
  value: string | undefined,
): WorkerRuntimeStatus | undefined {
  switch (value) {
    case 'idle':
    case 'running':
    case 'blocked':
    case 'done':
    case 'failed':
    case 'unknown':
      return value;
    default:
      return undefined;
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

function mergeWorkersWithSignals(
  snapshot: Pick<PersistedTeamSnapshot, 'workers'> | null,
  heartbeats: Record<string, PersistedWorkerHeartbeat>,
  statuses: Record<string, PersistedWorkerStatus>,
): WorkerSnapshot[] {
  const snapshotWorkerEntries: Array<[string, WorkerSnapshot]> = (
    snapshot?.workers ?? []
  ).map((worker) => [
      worker.workerId,
      {
        workerId: worker.workerId,
        status: normalizePersistedWorkerRuntimeStatus(worker.status) ?? 'unknown',
        lastHeartbeatAt: worker.lastHeartbeatAt,
        details: worker.details,
      },
    ]);

  const workersById = new Map<string, WorkerSnapshot>(snapshotWorkerEntries);
  const workerNames = new Set([
    ...workersById.keys(),
    ...Object.keys(heartbeats),
    ...Object.keys(statuses),
  ]);

  for (const workerName of [...workerNames].sort((a, b) => a.localeCompare(b))) {
    const existing = workersById.get(workerName);
    const heartbeat = heartbeats[workerName];
    const status = statuses[workerName];

    workersById.set(workerName, {
      workerId: workerName,
      status: resolveWorkerRuntimeStatus(existing?.status, status, heartbeat),
      lastHeartbeatAt: heartbeat?.updatedAt ?? existing?.lastHeartbeatAt,
      details: mergeWorkerDetails(existing?.details, heartbeat, status),
    });
  }

  return [...workersById.values()];
}

function countTasksByStatus(tasks: PersistedTaskRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const task of tasks) {
    const key = task.status;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function countWorkersByStatus(workers: WorkerSnapshot[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const worker of workers) {
    counts[worker.status] = (counts[worker.status] ?? 0) + 1;
  }
  return counts;
}

function summarizeTaskAuditEvents(events: PersistedTaskAuditEvent[]): {
  total: number;
  byAction: Record<'claim' | 'transition' | 'release', number>;
  byTask: Record<string, number>;
  byReasonCode: Record<string, number>;
  latestAt?: string;
} {
  const byAction: Record<'claim' | 'transition' | 'release', number> = {
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

function resolveRuntimeStatus(
  snapshot: PersistedTeamSnapshot | null,
): TeamRuntimeStatus | 'missing' {
  if (!snapshot) {
    return 'missing';
  }

  if (snapshot.status === 'failed') {
    return 'failed';
  }

  switch (snapshot.status) {
    case 'starting':
    case 'running':
    case 'completed':
    case 'stopped':
    case 'unknown':
      return snapshot.status;
    default:
      return 'unknown';
  }
}

function toRuntimeBackend(backend: string): TeamSnapshot['backend'] | undefined {
  if (backend === 'tmux' || backend === 'subagents') {
    return backend;
  }

  return undefined;
}

function toHealthSnapshot(
  snapshot: PersistedTeamSnapshot | null,
  workers: WorkerSnapshot[],
): TeamSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  const backend = toRuntimeBackend(snapshot.backend);
  if (!backend) {
    return undefined;
  }

  switch (snapshot.status) {
    case 'starting':
    case 'running':
    case 'completed':
    case 'stopped':
    case 'unknown':
      return {
        handleId: snapshot.handleId,
        teamName: snapshot.teamName,
        backend,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
        workers,
        summary: snapshot.summary,
        failureReason: snapshot.failureReason,
        runtime: snapshot.runtime,
      };
    default:
      return {
        handleId: snapshot.handleId,
        teamName: snapshot.teamName,
        backend,
        status: 'unknown',
        updatedAt: snapshot.updatedAt,
        workers,
        summary: snapshot.summary,
        failureReason: snapshot.failureReason,
        runtime: snapshot.runtime,
      };
  }
}

function hasAnyState(params: {
  phase: unknown;
  snapshot: unknown;
  tasks: PersistedTaskRecord[];
  taskAuditEvents: PersistedTaskAuditEvent[];
  heartbeats: Record<string, PersistedWorkerHeartbeat>;
  statuses: Record<string, PersistedWorkerStatus>;
}): boolean {
  return (
    params.phase !== null ||
    params.snapshot !== null ||
    params.tasks.length > 0 ||
    params.taskAuditEvents.length > 0 ||
    Object.keys(params.heartbeats).length > 0 ||
    Object.keys(params.statuses).length > 0
  );
}

async function defaultStatusRunner(input: TeamStatusInput): Promise<TeamStatusOutput> {
  let teamName: string;
  try {
    teamName = normalizeTeamName(input.teamName);
  } catch (error) {
    return {
      exitCode: 1,
      message: `Invalid team name: ${(error as Error).message}`,
      details: {
        teamName: input.teamName,
      },
    };
  }

  const stateStore = new TeamStateStore({ cwd: input.cwd });

  const [phase, snapshot, tasks, taskAuditEvents, heartbeats, statuses] = await Promise.all([
    stateStore.readPhaseState(teamName),
    stateStore.readMonitorSnapshot(teamName),
    stateStore.listTasks(teamName),
    stateStore.readTaskAuditEvents(teamName),
    stateStore.readAllWorkerHeartbeats(teamName),
    stateStore.readAllWorkerStatuses(teamName),
  ]);

  if (
    !hasAnyState({
      phase,
      snapshot,
      tasks,
      taskAuditEvents,
      heartbeats,
      statuses,
    })
  ) {
    return {
      exitCode: 1,
      message: `No persisted state found for team "${teamName}".`,
      details: {
        teamName,
        stateRoot: stateStore.rootDir,
      },
    };
  }

  const mergedWorkers = mergeWorkersWithSignals(snapshot, heartbeats, statuses);
  const runtimeStatus = resolveRuntimeStatus(snapshot);
  const mergedSnapshot =
    snapshot === null
      ? undefined
      : {
          ...snapshot,
          workers: mergedWorkers,
        };
  const healthSnapshot = toHealthSnapshot(snapshot, mergedWorkers);

  const health =
    healthSnapshot === undefined
      ? undefined
      : evaluateTeamHealth(healthSnapshot);
  const taskCounts = countTasksByStatus(tasks);
  const workerCounts = countWorkersByStatus(mergedWorkers);
  const taskAudit = summarizeTaskAuditEvents(taskAuditEvents);
  const requiredCompleted = tasks.filter(
    (task) => task.required === true && task.status === 'completed',
  ).length;
  const operationalStop =
    snapshot !== null &&
    isRecord(snapshot.runtime) &&
    snapshot.runtime.operationalStop === true;
  const stoppedBeforeCompletion =
    runtimeStatus === 'stopped' && phase?.currentPhase !== 'completed';

  const exitCode =
    phase?.currentPhase === 'failed' ||
    runtimeStatus === 'failed' ||
    stoppedBeforeCompletion ||
    (health ? !health.healthy : false)
      ? 1
      : 0;

  const summaryParts = [
    `phase=${phase?.currentPhase ?? 'unknown'}`,
    `runtime=${runtimeStatus}`,
    health ? `healthy=${health.healthy}` : 'healthy=unknown',
    `tasks=${tasks.length}`,
    `audits=${taskAudit.total}`,
    `workers=${mergedWorkers.length}`,
  ];

  return {
    exitCode,
    message: `Team "${teamName}" status: ${summaryParts.join(', ')}`,
    details: {
      teamName,
      stateRoot: stateStore.rootDir,
      phase: phase?.currentPhase ?? 'unknown',
      runtimeStatus,
      operationalStop,
      stoppedBeforeCompletion,
      snapshot: mergedSnapshot,
      health,
      taskCounts: {
        ...taskCounts,
        requiredCompleted,
      },
      taskAudit: {
        ...taskAudit,
        logPath: stateStore.getTaskAuditLogPath(teamName),
      },
      workerCounts,
      workers: mergedWorkers,
    },
  };
}

export async function executeTeamStatusCommand(
  argv: string[],
  context: TeamStatusCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printTeamStatusHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'team',
    'json',
    'help',
    'h',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(
      `Unexpected positional arguments: ${parsed.positionals.join(' ')}.`,
    );
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let teamName: string;
  try {
    teamName = normalizeTeamName(getStringOption(parsed.options, ['team']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const input: TeamStatusInput = {
    teamName,
    cwd: context.cwd,
  };

  const runner =
    context.statusRunner ??
    context.teamStatusRunner ??
    defaultStatusRunner;
  const output = await runner(input);

  if (hasFlag(parsed.options, ['json'])) {
    io.stdout(JSON.stringify(output, null, 2));
  } else {
    io.stdout(output.message);
    if (output.details && isRecord(output.details)) {
      io.stdout(JSON.stringify(output.details, null, 2));
    }
  }

  return {
    exitCode: output.exitCode,
  };
}
