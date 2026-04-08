import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { runCli } from '../../src/cli/index.js';
import { executeTeamCancelCommand } from '../../src/cli/commands/team-cancel.js';
import { executeTeamResumeCommand } from '../../src/cli/commands/team-resume.js';
import { executeTeamShutdownCommand } from '../../src/cli/commands/team-shutdown.js';
import { executeTeamStatusCommand } from '../../src/cli/commands/team-status.js';
import type { CliIo } from '../../src/cli/types.js';
import {
  CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
  TeamStateStore,
} from '../../src/state/team-state-store.js';
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

describe('reliability: team lifecycle command surface', () => {
  test('team status summarizes persisted phase/snapshot/task data', async () => {
    const tempRoot = createTempDir('omp-team-status-command-');

    try {
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omp', 'state'),
      });

      await stateStore.writePhaseState('demo-team', {
        teamName: 'demo-team',
        runId: 'run-123',
        currentPhase: 'verify',
        maxFixAttempts: 3,
        currentFixAttempt: 1,
        transitions: [],
        updatedAt: new Date('2026-03-02T00:00:00.000Z').toISOString(),
      });
      await stateStore.writeMonitorSnapshot('demo-team', {
        runId: 'run-123',
        teamName: 'demo-team',
        handleId: 'tmux-handle-1',
        backend: 'tmux',
        status: 'running',
        updatedAt: new Date('2026-03-02T00:00:10.000Z').toISOString(),
        workers: [
          {
            workerId: 'worker-1',
            status: 'running',
            lastHeartbeatAt: new Date('2026-03-02T00:00:09.000Z').toISOString(),
          },
          {
            workerId: 'worker-2',
            status: 'done',
            lastHeartbeatAt: new Date('2026-03-02T00:00:08.000Z').toISOString(),
          },
        ],
        runtime: {
          sessionName: 'demo-team-session',
        },
      });
      await stateStore.writeTask(
        'demo-team',
        {
          id: '1',
          subject: 'task one',
          status: 'completed',
          required: true,
        },
        {
          lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
        },
      );
      await stateStore.writeTask(
        'demo-team',
        {
          id: '2',
          subject: 'task two',
          status: 'in_progress',
        },
        {
          lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
        },
      );

      const ioCapture = createIoCapture();

      const result = await executeTeamStatusCommand(['--team', 'demo-team', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(1);
      expect(ioCapture.stderr).toStrictEqual([]);

      const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: {
          phase?: string;
          taskCounts?: Record<string, number>;
          runtimeStatus?: string;
        };
      };

      expect(payload.exitCode).toBe(1);
      expect(payload.details?.phase).toBe('verify');
      expect(payload.details?.runtimeStatus).toBe('running');
      expect(payload.details?.taskCounts?.completed).toBe(1);
      expect(payload.details?.taskCounts?.in_progress).toBe(1);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('team status rejects unknown options with usage exit code', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamStatusCommand(['--team', 'demo-team', '--bogus'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/unknown option/i);
  });

  test('team resume forwards parsed options to custom runner', async () => {
    const ioCapture = createIoCapture();
    let observedInput:
      | {
          teamName: string;
          maxFixLoop?: number;
          watchdogMs?: number;
          nonReportingMs?: number;
          backend?: string;
          workers?: number;
          subagents?: string[];
        }
      | undefined;

    const result = await executeTeamResumeCommand(
      [
        '--team',
        'demo-team',
        '--backend',
        'subagents',
        '--workers',
        '2',
        '--subagents',
        'planner,executor',
        '--max-fix-loop',
        '1',
        '--watchdog-ms',
        '90000',
        '--non-reporting-ms',
        '180000',
        '--json',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        resumeRunner: async (input) => {
          observedInput = {
            teamName: input.teamName,
            maxFixLoop: input.maxFixLoop,
            watchdogMs: input.watchdogMs,
            nonReportingMs: input.nonReportingMs,
            backend: input.backend,
            workers: input.workers,
            subagents: input.subagents,
          };
          return {
            exitCode: 0,
            message: 'resume-ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observedInput).toStrictEqual({
      teamName: 'demo-team',
      backend: 'subagents',
      workers: 2,
      subagents: ['planner', 'executor'],
      maxFixLoop: 1,
      watchdogMs: 90000,
      nonReportingMs: 180000,
    });
  });

  test('team resume validates max-fix-loop bounds', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamResumeCommand(
      ['--team', 'demo-team', '--max-fix-loop', '999'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --max-fix-loop/i);
  });

  test('team cancel marks non-terminal tasks cancelled and phase failed', async () => {
    const tempRoot = createTempDir('omp-team-cancel-');
    const ioCapture = createIoCapture();

    try {
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date('2026-03-02T00:00:00.000Z').toISOString();

      await stateStore.writePhaseState('demo-team', {
        teamName: 'demo-team',
        runId: 'run-cancel-1',
        currentPhase: 'exec',
        maxFixAttempts: 3,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeTask(
        'demo-team',
        { id: '1', subject: 'active task', status: 'in_progress' },
        { lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE },
      );
      await stateStore.writeTask(
        'demo-team',
        { id: '2', subject: 'done task', status: 'completed' },
        { lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE },
      );

      const result = await executeTeamCancelCommand(['--team', 'demo-team', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(0);
      const cancelledTask = await stateStore.readTask('demo-team', '1');
      const completedTask = await stateStore.readTask('demo-team', '2');
      const phase = await stateStore.readPhaseState('demo-team');
      expect(cancelledTask?.status).toBe('cancelled');
      expect(completedTask?.status).toBe('completed');
      expect(phase?.currentPhase).toBe('failed');
      expect(phase?.lastError).toMatch(/cancelled via omp team cancel/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('team shutdown forwards force flag to custom runner', async () => {
    const ioCapture = createIoCapture();
    let observedForce: boolean | undefined;

    const result = await executeTeamShutdownCommand(
      ['--team', 'demo-team', '--force', '--json'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        shutdownRunner: async (input) => {
          observedForce = input.force;
          return {
            exitCode: 0,
            message: 'shutdown-ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observedForce).toBe(true);
  });

  test('team shutdown treats missing snapshot as no-op with --force', async () => {
    const tempRoot = createTempDir('omp-team-shutdown-nosnapshot-');

    try {
      const ioCapture = createIoCapture();

      const result = await executeTeamShutdownCommand(
        ['--team', 'demo-team', '--force', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);
      const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
        details?: { teamName?: string };
      };
      expect(payload.details?.teamName).toBe('demo-team');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('runCli dispatches team status/resume/shutdown/cancel subcommands via injected runners', async () => {
    const ioCapture = createIoCapture();
    const observed: string[] = [];

    const statusExit = await runCli(['team', 'status', '--team', 'demo-team'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      teamStatus: {
        statusRunner: async () => {
          observed.push('status');
          return {
            exitCode: 0,
            message: 'status-ok',
          };
        },
      },
    });

    const resumeExit = await runCli(['team', 'resume', '--team', 'demo-team'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      teamResume: {
        resumeRunner: async () => {
          observed.push('resume');
          return {
            exitCode: 0,
            message: 'resume-ok',
          };
        },
      },
    });

    const shutdownExit = await runCli(['team', 'shutdown', '--team', 'demo-team'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      teamShutdown: {
        shutdownRunner: async () => {
          observed.push('shutdown');
          return {
            exitCode: 0,
            message: 'shutdown-ok',
          };
        },
      },
    });

    const cancelExit = await runCli(['team', 'cancel', '--team', 'demo-team'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      teamCancel: {
        cancelRunner: async () => {
          observed.push('cancel');
          return {
            exitCode: 0,
            message: 'cancel-ok',
          };
        },
      },
    });

    expect(statusExit).toBe(0);
    expect(resumeExit).toBe(0);
    expect(shutdownExit).toBe(0);
    expect(cancelExit).toBe(0);
    expect(observed).toStrictEqual(['status', 'resume', 'shutdown', 'cancel']);
  });

  test('runCli dispatches update and uninstall via injected runners', async () => {
    const ioCapture = createIoCapture();
    const observed: string[] = [];

    const updateExit = await runCli(['update'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      update: {
        updateRunner: async () => {
          observed.push('update');
          return { exitCode: 0, message: 'update-ok' };
        },
      },
    });

    const uninstallExit = await runCli(['uninstall'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      uninstall: {
        uninstallRunner: async () => {
          observed.push('uninstall');
          return { exitCode: 0, message: 'uninstall-ok' };
        },
      },
    });

    expect(updateExit).toBe(0);
    expect(uninstallExit).toBe(0);
    expect(observed).toStrictEqual(['update', 'uninstall']);
  });
});
