import { randomUUID } from 'node:crypto';

import type {
  TeamHandle,
  TeamSnapshot,
  TeamStartInput,
  WorkerSnapshot,
} from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';
import { runCommand, shellEscape } from './process-utils.js';

const DEFAULT_BOOTSTRAP_COMMAND =
  "printf '[oh-my-gemini] tmux runtime started\\n' && sleep 1";

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

function parsePaneWorkers(stdout: string, fallbackHeartbeatAt: string): WorkerSnapshot[] {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [
      paneIdRaw,
      paneDeadRaw,
      paneDeadStatusRaw,
      paneCommandRaw,
      paneActiveRaw,
      paneActivityRaw,
    ] = line.split('\t');

    const paneId = paneIdRaw?.trim() || `pane-${randomUUID().slice(0, 8)}`;
    const paneDead = paneDeadRaw?.trim() === '1';
    const paneDeadStatus = Number.parseInt(paneDeadStatusRaw?.trim() || '0', 10);
    const exitNonZero = Number.isFinite(paneDeadStatus) && paneDeadStatus !== 0;
    const status = paneDead || exitNonZero ? 'failed' : 'running';

    const command = paneCommandRaw?.trim();
    const activeState = paneActiveRaw?.trim();
    const activityIso =
      parseTmuxActivityToIso(paneActivityRaw?.trim() || '') ?? fallbackHeartbeatAt;

    const detailsParts = [`command=${command || 'unknown'}`];
    if (activeState) {
      detailsParts.push(`pane=${activeState}`);
    }
    if (paneDead) {
      detailsParts.push(`dead_status=${Number.isNaN(paneDeadStatus) ? 'unknown' : paneDeadStatus}`);
    }

    return {
      workerId: paneId,
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
    const sessionName = sanitizeSessionName(`${input.teamName}-${Date.now()}`);
    const command = buildCommand(input.command, input.env);

    const result = await runCommand(
      'tmux',
      ['new-session', '-d', '-s', sessionName, '-c', input.cwd, command],
      {
        cwd: input.cwd,
        ignoreNonZero: true,
      },
    );

    if (result.code !== 0) {
      throw new Error(
        result.stderr ||
          `Failed to create tmux session "${sessionName}" for ${input.teamName}`,
      );
    }

    return {
      id: `tmux-${randomUUID()}`,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      metadata: input.metadata,
      runtime: {
        sessionName,
        command,
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
        runtime: handle.runtime,
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
      const paneCapture = await runCommand(
        'tmux',
        ['capture-pane', '-pt', `${sessionName}:0`],
        {
          cwd: handle.cwd,
          ignoreNonZero: true,
        },
      );

      const paneList = await runCommand(
        'tmux',
        [
          'list-panes',
          '-t',
          sessionName,
          '-F',
          '#{pane_id}\t#{pane_dead}\t#{pane_dead_status}\t#{pane_current_command}\t#{?pane_active,active,inactive}\t#{pane_activity}',
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
                workerId: `${sessionName}:0`,
                status: 'running' as const,
                lastHeartbeatAt: observedAt,
                details: paneCapture.stdout
                  .split('\n')
                  .filter(Boolean)
                  .slice(-1)
                  .join('\n'),
              },
            ];

      const deadPanes = workers.filter((worker) => worker.status === 'failed');
      const runtimeStatus = deadPanes.length > 0 ? 'failed' : 'running';
      const summary =
        runtimeStatus === 'failed'
          ? `tmux session "${sessionName}" has dead pane(s): ${deadPanes
              .map((worker) => worker.workerId)
              .join(', ')}.`
          : `tmux session "${sessionName}" is active with ${workers.length} pane(s).`;

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
            ? `Detected dead tmux pane(s): ${deadPanes
                .map((worker) => worker.workerId)
                .join(', ')}.`
            : undefined,
        runtime: handle.runtime,
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
      runtime: handle.runtime,
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
