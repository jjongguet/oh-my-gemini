import { describe, expect, test } from 'vitest';

import { executeTeamShutdownCommand } from '../../src/cli/commands/team-shutdown.js';
import { TeamStateStore } from '../../src/state/index.js';
import type { CliIo } from '../../src/cli/types.js';
import type { TeamShutdownInput } from '../../src/cli/commands/team-shutdown.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function createIoCapture(): {
  io: CliIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout(message: string) {
        stdout.push(message);
      },
      stderr(message: string) {
        stderr.push(message);
      },
    },
    stdout,
    stderr,
  };
}

describe('reliability: team shutdown command', () => {
  test('prints help', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamShutdownCommand(['--help'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omg team shutdown/i);
  });

  test('fails with usage error for unknown option', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamShutdownCommand(['--bad'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unknown option\(s\): --bad/i);
  });

  test('fails with usage error for unsafe team identifier', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamShutdownCommand(['--team', '..'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --team value/i);
  });

  test('returns failure when monitor snapshot is missing without --force', async () => {
    const tempRoot = createTempDir('omg-team-shutdown-missing-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeTeamShutdownCommand(['--team', 'missing-team'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(1);
      expect(ioCapture.stdout.join('\n')).toMatch(/no persisted monitor snapshot was found/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('treats missing monitor snapshot as no-op when --force is set', async () => {
    const tempRoot = createTempDir('omg-team-shutdown-force-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeTeamShutdownCommand(
        ['--team', 'missing-team', '--force', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);

      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: { stateRoot?: string };
      };

      expect(output.exitCode).toBe(0);
      expect(typeof output.details?.stateRoot).toBe('string');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('marks non-terminal phase as failed to keep shutdown distinct from success completion', async () => {
    const tempRoot = createTempDir('omg-team-shutdown-phase-failed-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'shutdown-phase-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.ensureTeamScaffold(teamName);
      await stateStore.writePhaseState(teamName, {
        teamName,
        runId: 'run-shutdown-phase-1',
        currentPhase: 'exec',
        maxFixAttempts: 1,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-shutdown-phase-1',
        teamName,
        handleId: 'handle-shutdown-phase-1',
        backend: 'subagents',
        status: 'running',
        updatedAt: now,
        workers: [],
        runtime: {},
      });

      const result = await executeTeamShutdownCommand(
        ['--team', teamName, '--force', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);

      const phase = await stateStore.readPhaseState(teamName);
      expect(phase?.currentPhase).toBe('failed');
      expect(phase?.lastError).toMatch(/Operational shutdown requested/i);
      expect(phase?.transitions.at(-1)?.from).toBe('exec');
      expect(phase?.transitions.at(-1)?.to).toBe('failed');

      const snapshot = await stateStore.readMonitorSnapshot(teamName);
      expect(snapshot?.status).toBe('stopped');
      expect(snapshot?.runtime?.operationalStop).toBe(true);
      const lifecycleHooks = snapshot?.runtime?.lifecycleHooks as
        | { stop?: string }
        | undefined;
      expect(typeof lifecycleHooks?.stop).toBe('string');
      expect(lifecycleHooks?.stop).toContain('event=stop');

      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        details?: { stopHookContext?: string };
      };
      expect(output.details?.stopHookContext).toContain('event=stop');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('preserves completed phase when shutdown is requested after successful completion', async () => {
    const tempRoot = createTempDir('omg-team-shutdown-phase-completed-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'shutdown-completed-phase-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.ensureTeamScaffold(teamName);
      await stateStore.writePhaseState(teamName, {
        teamName,
        runId: 'run-shutdown-phase-2',
        currentPhase: 'completed',
        maxFixAttempts: 1,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-shutdown-phase-2',
        teamName,
        handleId: 'handle-shutdown-phase-2',
        backend: 'subagents',
        status: 'completed',
        updatedAt: now,
        workers: [],
        runtime: {
          verifyBaselinePassed: true,
        },
      });

      const result = await executeTeamShutdownCommand(
        ['--team', teamName, '--force', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);

      const phase = await stateStore.readPhaseState(teamName);
      expect(phase?.currentPhase).toBe('completed');
      expect(phase?.transitions).toHaveLength(0);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('updates snapshot to stopped after injected successful shutdown', async () => {
    const tempRoot = createTempDir('omg-team-shutdown-snapshot-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'shutdown-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-shutdown-1',
        teamName,
        handleId: 'handle-shutdown-1',
        backend: 'tmux',
        status: 'running',
        updatedAt: now,
        workers: [],
        runtime: {},
      });

      const result = await executeTeamShutdownCommand(
        ['--team', teamName, '--force'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
          shutdownRunner: async (input: TeamShutdownInput) => {
            await stateStore.writeMonitorSnapshot(input.teamName, {
              runId: 'run-shutdown-1',
              teamName: input.teamName,
              handleId: 'handle-shutdown-1',
              backend: 'tmux',
              status: 'stopped',
              updatedAt: new Date().toISOString(),
              workers: [],
              runtime: {
                shutdownForce: input.force,
              },
            });

            return {
              exitCode: 0,
              message: 'ok',
            };
          },
        },
      );

      expect(result.exitCode).toBe(0);

      const snapshot = await stateStore.readMonitorSnapshot(teamName);
      expect(snapshot?.status).toBe('stopped');
      expect(snapshot?.runtime?.shutdownForce).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });
});
