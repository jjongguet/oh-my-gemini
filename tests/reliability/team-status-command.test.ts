import { describe, expect, test } from 'vitest';

import { executeTeamStatusCommand } from '../../src/cli/commands/team-status.js';
import {
  CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
  TeamStateStore,
} from '../../src/state/index.js';
import type { CliIo } from '../../src/cli/types.js';
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

describe('reliability: team status command', () => {
  test('prints help', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamStatusCommand(['--help'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omg team status/i);
  });

  test('fails with usage error for unknown option', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamStatusCommand(['--bogus'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unknown option\(s\): --bogus/i);
  });

  test('fails with usage error for unsafe team identifier', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamStatusCommand(['--team', '..'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --team value/i);
  });

  test('returns not-found style failure when team state is absent', async () => {
    const tempRoot = createTempDir('omg-team-status-missing-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeTeamStatusCommand(['--team', 'missing-team'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(1);
      expect(ioCapture.stdout.join('\n')).toMatch(/No persisted state found/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('returns success with structured details when persisted state exists', async () => {
    const tempRoot = createTempDir('omg-team-status-present-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'status-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.ensureTeamScaffold(teamName);
      await stateStore.writePhaseState(teamName, {
        teamName,
        runId: 'run-status-1',
        currentPhase: 'verify',
        maxFixAttempts: 1,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-status-1',
        teamName,
        handleId: 'handle-status-1',
        backend: 'subagents',
        status: 'completed',
        updatedAt: now,
        workers: [
          {
            workerId: 'worker-1',
            status: 'done',
            lastHeartbeatAt: now,
            details: 'deterministic worker output',
          },
        ],
        summary: 'status summary',
        runtime: {
          verifyBaselinePassed: true,
        },
      });

      await stateStore.writeTask(teamName, {
        id: '1',
        subject: 'status task',
        status: 'completed',
        required: true,
      }, {
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      });
      await stateStore.appendTaskAuditEvent(teamName, {
        taskId: '1',
        action: 'claim',
        worker: 'worker-1',
        fromStatus: 'pending',
        toStatus: 'in_progress',
        claimTokenDigest: 'digest-1',
        reasonCode: 'OMG_CP_TASK_CLAIM_ACCEPTED',
      });
      await stateStore.appendTaskAuditEvent(teamName, {
        taskId: '1',
        action: 'transition',
        worker: 'worker-1',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        claimTokenDigest: 'digest-1',
        reasonCode: 'OMG_CP_TASK_TRANSITION_COMPLETED',
      });

      const result = await executeTeamStatusCommand(
        ['--team', teamName, '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(ioCapture.stderr).toStrictEqual([]);

      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: {
          phase?: string;
          runtimeStatus?: string;
          taskCounts?: { completed?: number; requiredCompleted?: number };
          taskAudit?: {
            total?: number;
            byAction?: { claim?: number; transition?: number };
            byReasonCode?: Record<string, number>;
            logPath?: string;
          };
          workerCounts?: { done?: number };
        };
      };

      expect(output.exitCode).toBe(0);
      expect(output.details?.phase).toBe('verify');
      expect(output.details?.runtimeStatus).toBe('completed');
      expect(output.details?.taskCounts?.completed).toBe(1);
      expect(output.details?.taskCounts?.requiredCompleted).toBe(1);
      expect(output.details?.taskAudit?.total).toBe(2);
      expect(output.details?.taskAudit?.byAction?.claim).toBe(1);
      expect(output.details?.taskAudit?.byAction?.transition).toBe(1);
      expect(output.details?.taskAudit?.byReasonCode?.['OMG_CP_TASK_CLAIM_ACCEPTED']).toBe(1);
      expect(output.details?.taskAudit?.byReasonCode?.['OMG_CP_TASK_TRANSITION_COMPLETED']).toBe(1);
      expect(typeof output.details?.taskAudit?.logPath).toBe('string');
      expect(output.details?.workerCounts?.done).toBe(1);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('accepts gemini-spawn as persisted runtime backend', async () => {
    const tempRoot = createTempDir('omg-team-status-gemini-spawn-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'status-gemini-spawn-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.ensureTeamScaffold(teamName);
      await stateStore.writePhaseState(teamName, {
        teamName,
        runId: 'run-status-gemini-spawn-1',
        currentPhase: 'verify',
        maxFixAttempts: 1,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-status-gemini-spawn-1',
        teamName,
        handleId: 'handle-status-gemini-spawn-1',
        backend: 'gemini-spawn',
        status: 'completed',
        updatedAt: now,
        workers: [],
        runtime: {
          verifyBaselinePassed: true,
        },
      });

      const result = await executeTeamStatusCommand(
        ['--team', teamName, '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: { backend?: string; runtimeStatus?: string };
      };
      expect(output.exitCode).toBe(0);
      expect(output.details?.backend).toBe('gemini-spawn');
      expect(output.details?.runtimeStatus).toBe('completed');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('treats stopped runtime as non-success unless phase is completed', async () => {
    const tempRoot = createTempDir('omg-team-status-stopped-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'status-stopped-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.ensureTeamScaffold(teamName);
      await stateStore.writePhaseState(teamName, {
        teamName,
        runId: 'run-status-stopped-1',
        currentPhase: 'exec',
        maxFixAttempts: 1,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-status-stopped-1',
        teamName,
        handleId: 'handle-status-stopped-1',
        backend: 'tmux',
        status: 'stopped',
        updatedAt: now,
        workers: [],
        runtime: {
          operationalStop: true,
        },
      });

      const result = await executeTeamStatusCommand(
        ['--team', teamName, '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(1);

      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: {
          runtimeStatus?: string;
          operationalStop?: boolean;
        };
      };

      expect(output.exitCode).toBe(1);
      expect(output.details?.runtimeStatus).toBe('stopped');
      expect(output.details?.operationalStop).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('does not mark stopped runtime as operational stop without explicit runtime flag', async () => {
    const tempRoot = createTempDir('omg-team-status-stopped-unexpected-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'status-stopped-unexpected-team';
      const stateStore = new TeamStateStore({ cwd: tempRoot });
      const now = new Date().toISOString();

      await stateStore.ensureTeamScaffold(teamName);
      await stateStore.writePhaseState(teamName, {
        teamName,
        runId: 'run-status-stopped-2',
        currentPhase: 'exec',
        maxFixAttempts: 1,
        currentFixAttempt: 0,
        transitions: [],
        updatedAt: now,
      });
      await stateStore.writeMonitorSnapshot(teamName, {
        runId: 'run-status-stopped-2',
        teamName,
        handleId: 'handle-status-stopped-2',
        backend: 'tmux',
        status: 'stopped',
        updatedAt: now,
        workers: [],
        runtime: {},
      });

      const result = await executeTeamStatusCommand(
        ['--team', teamName, '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(1);

      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: {
          runtimeStatus?: string;
          operationalStop?: boolean;
          stoppedBeforeCompletion?: boolean;
        };
      };

      expect(output.exitCode).toBe(1);
      expect(output.details?.runtimeStatus).toBe('stopped');
      expect(output.details?.operationalStop).toBe(false);
      expect(output.details?.stoppedBeforeCompletion).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });
});
