import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  DEFAULT_WORKERS,
  MAX_WORKERS,
  MIN_WORKERS,
} from '../../constants.js';
import { normalizeTeamNameCanonical } from '../../common/team-name.js';
import type {
  TeamHandle,
  TeamSnapshot,
  TeamStartInput,
  WorkerSnapshot,
} from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';
import { runCommand, shellEscape } from './process-utils.js';

const DEFAULT_BOOTSTRAP_COMMAND =
  "printf '[oh-my-gemini] tmux runtime started\\n'";
const DEFAULT_SESSION_WINDOW_WIDTH = 240;
const DEFAULT_SESSION_WINDOW_HEIGHT_MIN = 80;
const DEFAULT_ROWS_PER_WORKER = 12;

interface TmuxWorkerStatusCounts {
  running: number;
  done: number;
  failed: number;
  unknown: number;
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
  command: string | undefined,
  env: Record<string, string> | undefined,
): string {
  const baseCommand = command?.trim() || DEFAULT_BOOTSTRAP_COMMAND;

  if (!env || Object.keys(env).length === 0) {
    return baseCommand;
  }

  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${shellEscape(value)}`)
    .join(' ');

  return `env ${envPrefix} ${baseCommand}`;
}

function buildWorkerCommand(
  workerId: string,
  command: string | undefined,
  env: Record<string, string> | undefined,
  teamName: string,
  cwd: string,
): string {
  const stateRoot = resolveStateRoot(cwd, env);
  const canonicalTeamName = normalizeTeamNameCanonical(teamName);

  return buildCommand(command, {
    ...(env ?? {}),
    OMG_TEAM_WORKER: `${canonicalTeamName}/${workerId}`,
    OMX_TEAM_WORKER: `${canonicalTeamName}/${workerId}`,
    OMG_WORKER_NAME: workerId,
    OMG_TEAM_STATE_ROOT: stateRoot,
    OMX_TEAM_STATE_ROOT: stateRoot,
  });
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

export class TmuxRuntimeBackend implements RuntimeBackend {
  readonly name = 'tmux' as const;

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
    const commandTemplate = input.command?.trim() || DEFAULT_BOOTSTRAP_COMMAND;
    const firstWorkerCommand = buildWorkerCommand(
      'worker-1',
      input.command,
      input.env,
      input.teamName,
      input.cwd,
    );
    const firstWorkerDispatchCommand = `${firstWorkerCommand}; exit`;

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

    const dispatchFirstWorker = await runCommand(
      'tmux',
      ['send-keys', '-t', `${sessionName}:0.0`, firstWorkerDispatchCommand, 'C-m'],
      {
        cwd: input.cwd,
        ignoreNonZero: true,
      },
    );

    if (dispatchFirstWorker.code !== 0) {
      await runCommand('tmux', ['kill-session', '-t', sessionName], {
        cwd: input.cwd,
        ignoreNonZero: true,
      }).catch(() => undefined);
      throw new Error(
        dispatchFirstWorker.stderr ||
          `Failed to dispatch command for worker-1 in session "${sessionName}".`,
      );
    }

    for (let workerIndex = 2; workerIndex <= workers; workerIndex += 1) {
      const workerId = `worker-${workerIndex}`;
      const workerCommand = buildWorkerCommand(
        workerId,
        input.command,
        input.env,
        input.teamName,
        input.cwd,
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
    }

    await runCommand('tmux', ['select-layout', '-t', `${sessionName}:0`, 'tiled'], {
      cwd: input.cwd,
      ignoreNonZero: true,
    }).catch(() => undefined);

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

      const workers: WorkerSnapshot[] =
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

      const failedWorkers = workers.filter((worker) => worker.status === 'failed');
      const doneWorkers = workers.filter((worker) => worker.status === 'done');
      const workerStatusCounts = countWorkerStatuses(workers);

      const runtimeStatus =
        failedWorkers.length > 0
          ? 'failed'
          : workers.length > 0 && doneWorkers.length === workers.length
            ? 'completed'
            : 'running';

      const summary =
        runtimeStatus === 'failed'
          ? `tmux session "${sessionName}" has failed worker(s): ${failedWorkers
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
            ? `Detected failed worker pane(s): ${failedWorkers
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
  }
}
