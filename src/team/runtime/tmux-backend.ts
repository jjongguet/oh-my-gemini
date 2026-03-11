import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_WORKERS,
  DEFAULT_MAX_WORKER_RESTARTS,
  MAX_WORKERS,
  MIN_WORKERS,
} from '../../constants.js';
import { normalizeTeamNameCanonical } from '../../common/team-name.js';
import { buildRuntimeEnvironment } from '../../platform/index.js';
import { TeamStateStore } from '../../state/index.js';
import type {
  RecoveryRestartPolicy,
  TaskClaimEntry,
  TeamHandle,
  TeamSnapshot,
  TeamStartInput,
  WorkerSnapshot,
} from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';
import { runCommand, shellEscape } from './process-utils.js';

const DEFAULT_SESSION_WINDOW_WIDTH = 240;
const DEFAULT_WORKER_CLI = 'omg';
const OMG_TEAM_WORKER_CLI_ENV = 'OMG_TEAM_WORKER_CLI';
const OMX_TEAM_WORKER_CLI_ENV = 'OMX_TEAM_WORKER_CLI';
const OMG_TEAM_WORKER_CLI_MAP_ENV = 'OMG_TEAM_WORKER_CLI_MAP';
const OMX_TEAM_WORKER_CLI_MAP_ENV = 'OMX_TEAM_WORKER_CLI_MAP';

type TeamWorkerCli = 'omg' | 'gemini';

function resolveCliEntryPath(): string {
  return fileURLToPath(new URL('../../../dist/cli/index.js', import.meta.url));
}

function buildDefaultWorkerCommand(teamName: string, workerId: string): string {
  const cliPath = resolveCliEntryPath();
  return `node ${shellEscape(cliPath)} worker run --team ${shellEscape(teamName)} --worker ${shellEscape(workerId)}`;
}

function buildWorkerCliSelectionMetadata(selection: TeamWorkerCli[]): Record<string, TeamWorkerCli> {
  const result: Record<string, TeamWorkerCli> = {};

  for (const [index, workerCli] of selection.entries()) {
    result[`worker-${index + 1}`] = workerCli;
  }

  return result;
}

const DEFAULT_SESSION_WINDOW_HEIGHT_MIN = 80;

const DEFAULT_ROWS_PER_WORKER = 12;
const TMUX_SEND_KEYS_MAX_ATTEMPTS = 3;
const TMUX_SEND_KEYS_RETRY_DELAY_MS = 150;
const TMUX_DELIVERY_ACK_TIMEOUT_MS = 1_500;
const TMUX_DELIVERY_ACK_POLL_MS = 100;
const TMUX_HEALTH_HEARTBEAT_STALE_MS = 90_000;

function resolveMaxWorkerRestarts(input: TeamStartInput): number {
  if (input.maxWorkerRestarts !== undefined) {
    return Math.max(0, Math.floor(input.maxWorkerRestarts));
  }

  const envRaw = input.env?.OMG_MAX_WORKER_RESTARTS ?? process.env.OMG_MAX_WORKER_RESTARTS;
  if (envRaw !== undefined) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(parsed, 10);
    }
  }

  return DEFAULT_MAX_WORKER_RESTARTS;
}

function resolveRestartPolicy(input: TeamStartInput): RecoveryRestartPolicy {
  if (input.restartPolicy !== undefined) {
    return input.restartPolicy;
  }

  const envRaw = input.env?.OMG_WORKER_RESTART_POLICY ?? process.env.OMG_WORKER_RESTART_POLICY;
  if (envRaw !== undefined) {
    const normalized = envRaw.trim().toLowerCase();
    if (normalized === 'on-failure' || normalized === 'never') {
      return normalized;
    }
  }

  return 'on-failure';
}

interface WorkerRecoveryRecord {
  restartCount: number;
  lastRestartAt: string;
  permanentlyFailed: boolean;
}

interface SessionRecoveryContext {
  input: TeamStartInput;
  recovery: Map<string, WorkerRecoveryRecord>;
  maxRestarts: number;
  restartPolicy: RecoveryRestartPolicy;
}

interface TmuxWorkerStatusCounts {
  running: number;
  done: number;
  failed: number;
  unknown: number;
}

interface WorkerDeliveryAckState {
  workerId: string;
  acknowledged: boolean;
  observedSignal?: 'heartbeat' | 'status' | 'done';
  observedAt?: string;
}

function sanitizeSessionName(raw: string): string {
  const sanitized = raw
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return sanitized || 'oh-my-gemini';
}

function buildCommand(
  command: string,
  env: Record<string, string> | undefined,
): string {
  const baseCommand = command.trim();

  if (!env || Object.keys(env).length === 0) {
    return baseCommand;
  }

  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${shellEscape(value)}`)
    .join(' ');

  return `env ${envPrefix} ${baseCommand}`;
}

function normalizeWorkerCli(raw: string | undefined, source: string): TeamWorkerCli {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized || normalized === 'omg' || normalized === 'internal') {
    return 'omg';
  }

  if (normalized === 'gemini') {
    return 'gemini';
  }

  throw new Error(`Invalid ${source} value "${raw}". Supported: omg, gemini.`);
}

function resolveWorkerCliSelection(
  env: Record<string, string> | undefined,
  workers: number,
): TeamWorkerCli[] {
  const sourceEnv = {
    ...process.env,
    ...(env ?? {}),
  };

  const rawMap = (
    sourceEnv[OMG_TEAM_WORKER_CLI_MAP_ENV] ?? sourceEnv[OMX_TEAM_WORKER_CLI_MAP_ENV] ?? ''
  ).trim();

  if (rawMap) {
    const entries = rawMap.split(',').map((entry) => entry.trim());
    if (entries.some((entry) => entry.length === 0)) {
      throw new Error(`Invalid ${OMG_TEAM_WORKER_CLI_MAP_ENV} value "${rawMap}". Empty entries are not allowed.`);
    }

    if (entries.length !== 1 && entries.length != workers) {
      throw new Error(`Invalid ${OMG_TEAM_WORKER_CLI_MAP_ENV} length ${entries.length}; expected 1 or ${workers}.`);
    }

    const normalizedEntries = entries.map((entry) => normalizeWorkerCli(entry, OMG_TEAM_WORKER_CLI_MAP_ENV));
    const firstEntry = normalizedEntries[0];
    if (entries.length === 1) {
      if (!firstEntry) {
        throw new Error(`Invalid ${OMG_TEAM_WORKER_CLI_MAP_ENV} value "${rawMap}".`);
      }
      return Array.from({ length: workers }, () => firstEntry);
    }

    return normalizedEntries;
  }

  const defaultCli = normalizeWorkerCli(
    sourceEnv[OMG_TEAM_WORKER_CLI_ENV] ?? sourceEnv[OMX_TEAM_WORKER_CLI_ENV],
    OMG_TEAM_WORKER_CLI_ENV,
  );
  return Array.from({ length: workers }, () => defaultCli);
}

function buildWorkerCommand(
  workerId: string,
  command: string | undefined,
  env: Record<string, string> | undefined,
  teamName: string,
  cwd: string,
  taskClaim: TaskClaimEntry | undefined,
  workerCli: TeamWorkerCli
): string {
  const stateRoot = resolveStateRoot(cwd, env);
  const canonicalTeamName = normalizeTeamNameCanonical(teamName);
  const baseCommand = command?.trim() || buildDefaultWorkerCommand(teamName, workerId);
  const hasStringTaskClaim =
    typeof taskClaim?.taskId === 'string' &&
    taskClaim.taskId !== '' &&
    typeof taskClaim?.claimToken === 'string' &&
    taskClaim.claimToken !== '';

  const workerRuntimeEnv = buildRuntimeEnvironment({
    includeKeys: [],
    overrides: {
      ...(env ?? {}),
      OMG_TEAM_WORKER: `${canonicalTeamName}/${workerId}`,
      OMX_TEAM_WORKER: `${canonicalTeamName}/${workerId}`,
      OMG_WORKER_NAME: workerId,
      OMG_TEAM_WORKER_CLI: workerCli,
      OMX_TEAM_WORKER_CLI: workerCli,
      OMG_TEAM_STATE_ROOT: stateRoot,
      OMX_TEAM_STATE_ROOT: stateRoot,
      ...(hasStringTaskClaim
        ? {
            OMG_WORKER_TASK_ID: taskClaim.taskId,
            OMG_WORKER_CLAIM_TOKEN: taskClaim.claimToken,
          }
        : {}),
    },
  });

  return buildCommand(baseCommand, workerRuntimeEnv);
}

function getSessionName(handle: TeamHandle): string {
  const candidate = handle.runtime.sessionName;
  return typeof candidate === 'string' ? candidate : '';
}

function parseTmuxActivityToIso(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const asSeconds = Number(trimmed);
    if (Number.isFinite(asSeconds)) {
      const millis =
        asSeconds > 2_000_000_000 ? Math.floor(asSeconds) : Math.floor(asSeconds * 1000);
      return new Date(millis).toISOString();
    }
  }

  const parsedDate = Date.parse(trimmed);
  if (Number.isNaN(parsedDate)) {
    return undefined;
  }

  return new Date(parsedDate).toISOString();
}

function resolveWorkers(workers: number | undefined): number {
  if (workers === undefined) {
    return DEFAULT_WORKERS;
  }

  if (!Number.isInteger(workers)) {
    throw new Error(
      `Invalid workers value "${workers}". Expected integer between ${MIN_WORKERS} and ${MAX_WORKERS}.`,
    );
  }

  if (workers < MIN_WORKERS || workers > MAX_WORKERS) {
    throw new Error(
      `Invalid workers value "${workers}". Expected range ${MIN_WORKERS}..${MAX_WORKERS}.`,
    );
  }

  return workers;
}

function preferredSessionWindowHeight(workers: number): number {
  return Math.max(
    DEFAULT_SESSION_WINDOW_HEIGHT_MIN,
    workers * DEFAULT_ROWS_PER_WORKER,
  );
}

function buildTaskAuditLogPath(
  cwd: string,
  teamName: string,
  env: Record<string, string> | undefined,
): string {
  return path.join(
    resolveStateRoot(cwd, env),
    'team',
    normalizeTeamNameCanonical(teamName),
    'events',
    'task-lifecycle.ndjson',
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRuntimeStateRoot(handle: TeamHandle): string {
  const runtimeStateRoot = handle.runtime.stateRoot;
  if (typeof runtimeStateRoot === 'string' && runtimeStateRoot.trim()) {
    return runtimeStateRoot;
  }

  return resolveStateRoot(handle.cwd, undefined);
}

async function detectWorkerDeliveryAck(
  stateStore: TeamStateStore,
  teamName: string,
  workerId: string,
): Promise<WorkerDeliveryAckState> {
  const [heartbeat, status, doneSignal] = await Promise.all([
    stateStore.readWorkerHeartbeat(teamName, workerId),
    stateStore.readWorkerStatus(teamName, workerId),
    stateStore.readWorkerDone(teamName, workerId),
  ]);

  if (doneSignal) {
    return {
      workerId,
      acknowledged: true,
      observedSignal: 'done',
      observedAt: doneSignal.completedAt,
    };
  }

  if (heartbeat) {
    return {
      workerId,
      acknowledged: true,
      observedSignal: 'heartbeat',
      observedAt: heartbeat.updatedAt,
    };
  }

  if (status) {
    return {
      workerId,
      acknowledged: true,
      observedSignal: 'status',
      observedAt: status.updatedAt,
    };
  }

  return {
    workerId,
    acknowledged: false,
  };
}

async function waitForWorkerDeliveryAck(
  stateStore: TeamStateStore,
  teamName: string,
  workerId: string,
  timeoutMs = TMUX_DELIVERY_ACK_TIMEOUT_MS,
): Promise<WorkerDeliveryAckState> {
  const deadline = Date.now() + timeoutMs;

  do {
    const ack = await detectWorkerDeliveryAck(stateStore, teamName, workerId);
    if (ack.acknowledged) {
      return ack;
    }

    if (Date.now() >= deadline) {
      return ack;
    }

    await sleep(TMUX_DELIVERY_ACK_POLL_MS);
  } while (true);
}

async function sendTmuxKeysWithRetry(params: {
  cwd: string;
  paneTarget: string;
  command: string;
}): Promise<{ code: number | null; stdout: string; stderr: string; attempts: number }> {
  let lastResult = { code: 1, stdout: '', stderr: 'send-keys not attempted' } as {
    code: number | null;
    stdout: string;
    stderr: string;
  };

  for (let attempt = 1; attempt <= TMUX_SEND_KEYS_MAX_ATTEMPTS; attempt += 1) {
    lastResult = await runCommand(
      'tmux',
      ['send-keys', '-t', params.paneTarget, params.command, 'C-m'],
      {
        cwd: params.cwd,
        ignoreNonZero: true,
      },
    );

    if (lastResult.code === 0) {
      return {
        ...lastResult,
        attempts: attempt,
      };
    }

    if (attempt < TMUX_SEND_KEYS_MAX_ATTEMPTS) {
      await sleep(TMUX_SEND_KEYS_RETRY_DELAY_MS * attempt);
    }
  }

  return {
    ...lastResult,
    attempts: TMUX_SEND_KEYS_MAX_ATTEMPTS,
  };
}

function enrichPaneWorkersWithPersistedSignals(params: {
  workers: WorkerSnapshot[];
  heartbeats: Record<string, { alive: boolean; updatedAt: string; pid?: number; currentTaskId?: string; turnCount?: number }>;
  statuses: Record<string, { state: string; updatedAt: string; reason?: string; currentTaskId?: string }>;
  doneSignals: Record<string, { status: 'completed' | 'failed'; completedAt: string; summary?: string }>;
  observedAt: string;
}): WorkerSnapshot[] {
  const workersById = new Map<string, WorkerSnapshot>(
    params.workers.map((worker) => [worker.workerId, worker]),
  );
  const workerIds = new Set([
    ...workersById.keys(),
    ...Object.keys(params.heartbeats),
    ...Object.keys(params.statuses),
    ...Object.keys(params.doneSignals),
  ]);

  for (const workerId of [...workerIds].sort((a, b) => a.localeCompare(b))) {
    const existing = workersById.get(workerId);
    const heartbeat = params.heartbeats[workerId];
    const status = params.statuses[workerId];
    const doneSignal = params.doneSignals[workerId];

    let resolvedStatus = existing?.status ?? 'unknown';
    if (doneSignal) {
      resolvedStatus = doneSignal.status === 'completed' ? 'done' : 'failed';
    } else if (heartbeat?.alive === false) {
      resolvedStatus = 'failed';
    } else if (status?.state === 'in_progress') {
      resolvedStatus = 'running';
    } else if (status?.state === 'blocked') {
      resolvedStatus = 'blocked';
    } else if (status?.state === 'failed') {
      resolvedStatus = 'failed';
    } else if (status?.state === 'idle') {
      resolvedStatus = existing?.status === 'done' ? 'done' : 'idle';
    }

    const detailParts = [existing?.details];
    if (heartbeat?.alive === false) {
      detailParts.push('heartbeat=dead');
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
    if (status?.reason) {
      detailParts.push(`reason=${status.reason}`);
    }
    if (doneSignal?.summary) {
      detailParts.push(`done_signal=${doneSignal.status},summary=${doneSignal.summary}`);
    }

    workersById.set(workerId, {
      workerId,
      status: resolvedStatus,
      lastHeartbeatAt: heartbeat?.updatedAt ?? doneSignal?.completedAt ?? existing?.lastHeartbeatAt ?? params.observedAt,
      details: detailParts.filter((part): part is string => Boolean(part)).join(' | ') || undefined,
    });
  }

  return [...workersById.values()];
}

function buildPaneHealthSummary(params: {
  workers: WorkerSnapshot[];
  deliveryAcks: WorkerDeliveryAckState[];
  observedAt: string;
}): Record<string, unknown> {
  const observedAtMs = Date.parse(params.observedAt);
  let staleHeartbeatWorkers = 0;

  for (const worker of params.workers) {
    if (!worker.lastHeartbeatAt) {
      continue;
    }

    const heartbeatAtMs = Date.parse(worker.lastHeartbeatAt);
    if (Number.isNaN(heartbeatAtMs)) {
      continue;
    }

    if (observedAtMs - heartbeatAtMs > TMUX_HEALTH_HEARTBEAT_STALE_MS) {
      staleHeartbeatWorkers += 1;
    }
  }

  const missingDeliveryAckWorkers = params.deliveryAcks
    .filter((ack) => !ack.acknowledged)
    .map((ack) => ack.workerId);

  return {
    checkedAt: params.observedAt,
    staleHeartbeatWorkers,
    acknowledgedWorkers: params.deliveryAcks.filter((ack) => ack.acknowledged).length,
    missingDeliveryAckWorkers,
    healthy: staleHeartbeatWorkers === 0 && missingDeliveryAckWorkers.length === 0,
  };
}

function resolveStateRoot(
  cwd: string,
  env: Record<string, string> | undefined,
): string {
  return (
    env?.OMG_TEAM_STATE_ROOT ??
    env?.OMX_TEAM_STATE_ROOT ??
    env?.OMG_STATE_ROOT ??
    process.env.OMG_TEAM_STATE_ROOT ??
    process.env.OMX_TEAM_STATE_ROOT ??
    process.env.OMG_STATE_ROOT ??
    path.join(cwd, '.omg', 'state')
  );
}

function countWorkerStatuses(workers: WorkerSnapshot[]): TmuxWorkerStatusCounts {
  const counts: TmuxWorkerStatusCounts = {
    running: 0,
    done: 0,
    failed: 0,
    unknown: 0,
  };

  for (const worker of workers) {
    switch (worker.status) {
      case 'running':
        counts.running += 1;
        break;
      case 'done':
        counts.done += 1;
        break;
      case 'failed':
        counts.failed += 1;
        break;
      default:
        counts.unknown += 1;
        break;
    }
  }

  return counts;
}

function buildSplitFailureMessage(params: {
  stderr: string;
  workerIndex: number;
  workers: number;
  sessionName: string;
}): string {
  const { stderr, workerIndex, workers, sessionName } = params;
  const trimmed = stderr.trim();
  const message =
    trimmed ||
    `Failed to create tmux pane for worker-${workerIndex} in session "${sessionName}".`;

  if (!/no space for new pane/i.test(message)) {
    return message;
  }

  return `${message} (workers=${workers}). Try increasing tmux window size (or set window-size manual) or run with fewer workers.`;
}

function parsePaneWorkers(stdout: string, fallbackHeartbeatAt: string): WorkerSnapshot[] {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [
      paneIndexRaw,
      paneIdRaw,
      paneDeadRaw,
      paneDeadStatusRaw,
      paneCommandRaw,
      paneActiveRaw,
      paneActivityRaw,
    ] = line.split('\t');

    const paneIndex = Number.parseInt(paneIndexRaw?.trim() || '', 10);
    const workerId = Number.isFinite(paneIndex) ? `worker-${paneIndex + 1}` : `worker-${randomUUID().slice(0, 8)}`;
    const paneId = paneIdRaw?.trim() || 'unknown';

    const paneDead = paneDeadRaw?.trim() === '1';
    const paneDeadStatus = Number.parseInt(paneDeadStatusRaw?.trim() || '0', 10);
    const exitCode = Number.isFinite(paneDeadStatus) ? paneDeadStatus : 1;

    const status = paneDead
      ? exitCode === 0
        ? 'done'
        : 'failed'
      : 'running';

    const command = paneCommandRaw?.trim();
    const activeState = paneActiveRaw?.trim();
    const activityIso =
      parseTmuxActivityToIso(paneActivityRaw?.trim() || '') ?? fallbackHeartbeatAt;

    const detailsParts = [
      `pane_id=${paneId}`,
      `command=${command || 'unknown'}`,
    ];
    if (activeState) {
      detailsParts.push(`pane=${activeState}`);
    }
    if (paneDead) {
      detailsParts.push(`exit=${exitCode}`);
    }

    return {
      workerId,
      status,
      lastHeartbeatAt: activityIso,
      details: detailsParts.join(', '),
    };
  });
}

function extractPaneTargets(stdout: string): Map<string, string> {
  const targets = new Map<string, string>();
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split('\t');
    const paneIndex = Number.parseInt(parts[0]?.trim() || '', 10);
    const paneId = parts[1]?.trim() || '';
    if (Number.isFinite(paneIndex) && paneId) {
      targets.set(`worker-${paneIndex + 1}`, paneId);
    }
  }

  return targets;
}

export class TmuxRuntimeBackend implements RuntimeBackend {
  readonly name = 'tmux' as const;
  private readonly sessionContexts = new Map<string, SessionRecoveryContext>();

  async probePrerequisites(cwd: string): Promise<RuntimeProbeResult> {
    const issues: string[] = [];

    try {
      const version = await runCommand('tmux', ['-V'], {
        cwd,
        ignoreNonZero: true,
      });

      if (version.code !== 0) {
        issues.push(
          'tmux is installed but unavailable in the current shell PATH.',
        );
      }
    } catch {
      issues.push(
        'tmux is required for the default runtime backend. Install tmux and retry.',
      );
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  async startTeam(input: TeamStartInput): Promise<TeamHandle> {
    const workers = resolveWorkers(input.workers);
    const sessionName = sanitizeSessionName(`${input.teamName}-${Date.now()}`);
    const workerCliSelection = resolveWorkerCliSelection(input.env, workers);
    const commandTemplate = input.command?.trim() || buildDefaultWorkerCommand(input.teamName, 'worker-1');
    const firstWorkerId = 'worker-1';
    const firstWorkerCommand = buildWorkerCommand(
      firstWorkerId,
      input.command,
      input.env,
      input.teamName,
      input.cwd,
      input.taskClaims?.[firstWorkerId],
      workerCliSelection[0] ?? 'omg',
    );
    const firstWorkerDispatchCommand = `${firstWorkerCommand}; exit`;
    const stateRoot = resolveStateRoot(input.cwd, input.env);
    const stateStore = new TeamStateStore({ rootDir: stateRoot });
    const deliveryAcks: WorkerDeliveryAckState[] = [];

    const createSession = await runCommand(
      'tmux',
      ['new-session', '-d', '-s', sessionName, '-c', input.cwd],
      {
        cwd: input.cwd,
        ignoreNonZero: true,
      },
    );

    if (createSession.code !== 0) {
      throw new Error(
        createSession.stderr ||
          `Failed to create tmux session "${sessionName}" for ${input.teamName}`,
      );
    }

    const keepDeadPanes = await runCommand(
      'tmux',
      ['set-option', '-t', sessionName, 'remain-on-exit', 'on'],
      {
        cwd: input.cwd,
        ignoreNonZero: true,
      },
    );

    if (keepDeadPanes.code !== 0) {
      await runCommand('tmux', ['kill-session', '-t', sessionName], {
        cwd: input.cwd,
        ignoreNonZero: true,
      }).catch(() => undefined);
      throw new Error(
        keepDeadPanes.stderr || `Failed to configure remain-on-exit for "${sessionName}".`,
      );
    }

    await runCommand(
      'tmux',
      ['set-window-option', '-t', `${sessionName}:0`, 'window-size', 'manual'],
      {
        cwd: input.cwd,
        ignoreNonZero: true,
      },
    ).catch(() => undefined);

    await runCommand(
      'tmux',
      [
        'resize-window',
        '-t',
        `${sessionName}:0`,
        '-x',
        String(DEFAULT_SESSION_WINDOW_WIDTH),
        '-y',
        String(preferredSessionWindowHeight(workers)),
      ],
      {
        cwd: input.cwd,
        ignoreNonZero: true,
      },
    ).catch(() => undefined);

    const dispatchFirstWorker = await sendTmuxKeysWithRetry({
      cwd: input.cwd,
      paneTarget: `${sessionName}:0.0`,
      command: firstWorkerDispatchCommand,
    });

    if (dispatchFirstWorker.code !== 0) {
      await runCommand('tmux', ['kill-session', '-t', sessionName], {
        cwd: input.cwd,
        ignoreNonZero: true,
      }).catch(() => undefined);
      throw new Error(
        dispatchFirstWorker.stderr ||
          `Failed to dispatch command for worker-1 in session "${sessionName}" after ${dispatchFirstWorker.attempts} attempt(s).`,
      );
    }

    const firstWorkerAck = await waitForWorkerDeliveryAck(
      stateStore,
      input.teamName,
      firstWorkerId,
    );
    deliveryAcks.push(firstWorkerAck);
    for (let workerIndex = 2; workerIndex <= workers; workerIndex += 1) {
      const workerId = `worker-${workerIndex}`;
      const workerCommand = buildWorkerCommand(
        workerId,
        input.command,
        input.env,
        input.teamName,
        input.cwd,
        input.taskClaims?.[workerId],
        workerCliSelection[workerIndex - 1] ?? 'omg',
      );
      const splitResult = await runCommand(
        'tmux',
        ['split-window', '-d', '-t', `${sessionName}:0`, '-c', input.cwd, workerCommand],
        {
          cwd: input.cwd,
          ignoreNonZero: true,
        },
      );

      if (splitResult.code !== 0) {
        await runCommand('tmux', ['kill-session', '-t', sessionName], {
          cwd: input.cwd,
          ignoreNonZero: true,
        }).catch(() => undefined);
        throw new Error(
          buildSplitFailureMessage({
            stderr: splitResult.stderr,
            workerIndex,
            workers,
            sessionName,
          }),
        );
      }

      const workerAck = await waitForWorkerDeliveryAck(
        stateStore,
        input.teamName,
        workerId,
      );
      deliveryAcks.push(workerAck);
    }

    await runCommand('tmux', ['select-layout', '-t', `${sessionName}:0`, 'tiled'], {
      cwd: input.cwd,
      ignoreNonZero: true,
    }).catch(() => undefined);

    this.sessionContexts.set(sessionName, {
      input,
      recovery: new Map(),
      maxRestarts: resolveMaxWorkerRestarts(input),
      restartPolicy: resolveRestartPolicy(input),
    });

    return {
      id: `tmux-${randomUUID()}`,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      metadata: input.metadata,
      runtime: {
        sessionName,
        commandTemplate,
        workers,
        stateRoot,
        deliveryAcks,
        workerCliSelection: buildWorkerCliSelectionMetadata(workerCliSelection),
        taskAuditLogPath: buildTaskAuditLogPath(input.cwd, input.teamName, input.env),
      },
    };
  }

  async monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> {
    const sessionName = getSessionName(handle);
    const observedAt = new Date().toISOString();

    if (!sessionName) {
      return {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: 'failed',
        updatedAt: observedAt,
        workers: [],
        failureReason: 'Missing tmux session metadata in team handle.',
        runtime: {
          ...(handle.runtime ?? {}),
          verifyBaselinePassed: false,
          verifyBaselineSource: 'tmux-runtime',
        },
      };
    }

    const hasSession = await runCommand(
      'tmux',
      ['has-session', '-t', sessionName],
      {
        cwd: handle.cwd,
        ignoreNonZero: true,
      },
    );

    if (hasSession.code === 0) {
      const paneList = await runCommand(
        'tmux',
        [
          'list-panes',
          '-t',
          sessionName,
          '-F',
          '#{pane_index}\t#{pane_id}\t#{pane_dead}\t#{pane_dead_status}\t#{pane_current_command}\t#{?pane_active,active,inactive}\t#{pane_activity}',
        ],
        {
          cwd: handle.cwd,
          ignoreNonZero: true,
        },
      );

      const paneWorkers: WorkerSnapshot[] =
        paneList.code === 0
          ? parsePaneWorkers(paneList.stdout, observedAt)
          : [
              {
                workerId: 'worker-1',
                status: 'unknown' as const,
                lastHeartbeatAt: observedAt,
                details: 'pane_list_unavailable',
              },
            ];

      const stateStore = new TeamStateStore({
        rootDir: resolveRuntimeStateRoot(handle),
      });
      const [heartbeats, statuses, doneSignals] = await Promise.all([
        stateStore.readAllWorkerHeartbeats(handle.teamName).catch(() => ({})),
        stateStore.readAllWorkerStatuses(handle.teamName).catch(() => ({})),
        stateStore.readAllWorkerDoneSignals(handle.teamName).catch(() => ({})),
      ]);

      const workers = enrichPaneWorkersWithPersistedSignals({
        workers: paneWorkers,
        heartbeats,
        statuses,
        doneSignals,
        observedAt,
      });
      const deliveryAcks = await Promise.all(
        workers.map((worker) =>
          detectWorkerDeliveryAck(stateStore, handle.teamName, worker.workerId).catch(() => ({
            workerId: worker.workerId,
            acknowledged: false,
          })),
        ),
      );
      await this.recoverFailedWorkers(sessionName, handle, workers, paneList.code === 0 ? paneList.stdout : '');

      const failedWorkers = workers.filter((worker) => worker.status === 'failed');
      const doneWorkers = workers.filter((worker) => worker.status === 'done');
      const workerStatusCounts = countWorkerStatuses(workers);
      const paneHealth = buildPaneHealthSummary({
        workers,
        deliveryAcks,
        observedAt,
      });
      const missingDeliveryAckWorkers = Array.isArray(paneHealth.missingDeliveryAckWorkers)
        ? paneHealth.missingDeliveryAckWorkers as string[]
        : [];
      const staleHeartbeatWorkers = typeof paneHealth.staleHeartbeatWorkers === 'number'
        ? paneHealth.staleHeartbeatWorkers
        : 0;
      const expectedDeliveryAckWorkers = Array.isArray(handle.runtime.deliveryAcks)
        ? handle.runtime.deliveryAcks.length
        : 0;
      const deliveryAckHealthFailed =
        expectedDeliveryAckWorkers > 0 && missingDeliveryAckWorkers.length > 0;

      const runtimeStatus =
        failedWorkers.length > 0 || deliveryAckHealthFailed || staleHeartbeatWorkers > 0
          ? 'failed'
          : workers.length > 0 && doneWorkers.length === workers.length
            ? 'completed'
            : 'running';

      const summary =
        runtimeStatus === 'failed'
          ? deliveryAckHealthFailed
            ? `tmux session "${sessionName}" failed health checks; missing delivery acknowledgment for ${missingDeliveryAckWorkers.join(', ')}.`
            : `tmux session "${sessionName}" has failed worker(s): ${failedWorkers
                .map((worker) => worker.workerId)
                .join(', ')}.`
          : runtimeStatus === 'completed'
            ? `tmux session "${sessionName}" completed (${doneWorkers.length}/${workers.length} workers finished).`
            : `tmux session "${sessionName}" is active with ${workers.length} worker pane(s) (running=${workerStatusCounts.running}, done=${workerStatusCounts.done}, failed=${workerStatusCounts.failed}, unknown=${workerStatusCounts.unknown}).`;

      return {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: runtimeStatus,
        updatedAt: observedAt,
        workers,
        summary,
        failureReason:
          runtimeStatus === 'failed'
            ? deliveryAckHealthFailed
              ? `Missing worker delivery acknowledgment for ${missingDeliveryAckWorkers.join(', ')}.`
              : staleHeartbeatWorkers > 0
                ? `Detected ${staleHeartbeatWorkers} stale worker heartbeat(s).`
                : `Detected failed worker pane(s): ${failedWorkers
                    .map((worker) => worker.workerId)
                    .join(', ')}.`
            : undefined,
        runtime: {
          ...(handle.runtime ?? {}),
          verifyBaselinePassed: runtimeStatus === 'completed',
          verifyBaselineSource: 'tmux-runtime',
          sessionExists: true,
          paneCount: workers.length,
          workerStatusCounts,
          deliveryAcks,
          paneHealth,
          workerRecovery: this.getRecoverySnapshot(sessionName),
        },
      };
    }

    return {
      handleId: handle.id,
      teamName: handle.teamName,
      backend: this.name,
      status: 'stopped',
      updatedAt: observedAt,
      workers: [],
      failureReason:
        hasSession.stderr ||
        `tmux session "${sessionName}" is no longer running.`,
      runtime: {
        ...(handle.runtime ?? {}),
        verifyBaselinePassed: false,
        verifyBaselineSource: 'tmux-runtime',
        sessionExists: false,
        paneCount: 0,
      },
    };
  }

  async shutdownTeam(
    handle: TeamHandle,
    opts: { force?: boolean } = {},
  ): Promise<void> {
    const sessionName = getSessionName(handle);

    if (!sessionName) {
      if (!opts.force) {
        throw new Error('Cannot shutdown tmux runtime without a session name.');
      }
      return;
    }

    const result = await runCommand(
      'tmux',
      ['kill-session', '-t', sessionName],
      {
        cwd: handle.cwd,
        ignoreNonZero: true,
      },
    );

    if (result.code !== 0 && !opts.force) {
      throw new Error(
        result.stderr || `Failed to kill tmux session "${sessionName}".`,
      );
    }

    this.sessionContexts.delete(sessionName);
  }

  private async recoverFailedWorkers(
    sessionName: string,
    handle: TeamHandle,
    workers: WorkerSnapshot[],
    paneStdout: string,
  ): Promise<void> {
    const ctx = this.sessionContexts.get(sessionName);
    if (!ctx) return;

    if (ctx.restartPolicy === 'never') return;

    const paneTargets = extractPaneTargets(paneStdout);

    for (const worker of workers) {
      if (worker.status !== 'failed') continue;

      let record = ctx.recovery.get(worker.workerId);
      if (!record) {
        record = { restartCount: 0, lastRestartAt: '', permanentlyFailed: false };
        ctx.recovery.set(worker.workerId, record);
      }

      if (record.permanentlyFailed || record.restartCount >= ctx.maxRestarts) {
        record.permanentlyFailed = true;
        continue;
      }

      const paneId = paneTargets.get(worker.workerId);
      if (!paneId) continue;

      const workerCliMap = (handle.runtime?.workerCliSelection ?? {}) as Record<string, TeamWorkerCli>;
      const workerCommand = buildWorkerCommand(
        worker.workerId,
        ctx.input.command,
        ctx.input.env,
        ctx.input.teamName,
        ctx.input.cwd,
        ctx.input.taskClaims?.[worker.workerId],
        workerCliMap[worker.workerId] ?? 'omg',
      );

      const respawn = await runCommand(
        'tmux',
        ['respawn-pane', '-k', '-t', paneId, workerCommand],
        { cwd: handle.cwd, ignoreNonZero: true },
      );

      if (respawn.code === 0) {
        record.restartCount += 1;
        record.lastRestartAt = new Date().toISOString();
        worker.status = 'running';
        worker.details = `${worker.details ?? ''}, recovery=${record.restartCount}/${ctx.maxRestarts}`;
      } else {
        record.permanentlyFailed = true;
      }
    }
  }

  private getRecoverySnapshot(
    sessionName: string,
  ): Record<string, { restartCount: number; lastRestartAt: string; permanentlyFailed: boolean }> | undefined {
    const ctx = this.sessionContexts.get(sessionName);
    if (!ctx || ctx.recovery.size === 0) return undefined;

    const snapshot: Record<string, { restartCount: number; lastRestartAt: string; permanentlyFailed: boolean }> = {};
    for (const [workerId, record] of ctx.recovery) {
      snapshot[workerId] = { ...record };
    }
    return snapshot;
  }
}
