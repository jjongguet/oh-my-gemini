import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { executeWorkerRunCommand } from '../../src/cli/commands/worker-run.js';
import type { CliIo } from '../../src/cli/types.js';
import { TeamStateStore } from '../../src/state/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function createIoCapture(): { io: CliIo; stdout: string[]; stderr: string[] } {
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

describe('reliability: worker run command', () => {
  test('runs Gemini prompt mode when OMP_TEAM_WORKER_CLI=gemini', async () => {
    const tempRoot = createTempDir('omp-worker-gemini-');
    const ioCapture = createIoCapture();
    let observedPrompt = '';

    const previousTeamWorker = process.env.OMP_TEAM_WORKER;
    const previousWorkerCli = process.env.OMP_TEAM_WORKER_CLI;

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'GEMINI.md'),
        '# worker context\n\nDo the assigned task.',
        'utf8',
      );

      process.env.OMP_TEAM_WORKER = 'gemini-team/worker-1';
      process.env.OMP_TEAM_WORKER_CLI = 'gemini';

      const result = await executeWorkerRunCommand([], {
        cwd: tempRoot,
        io: ioCapture.io,
        runGeminiPromptFn: async ({ prompt }) => {
          observedPrompt = prompt;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(observedPrompt).toContain('worker worker-1');
      expect(observedPrompt).toContain('gemini-team');
      expect(observedPrompt).toContain('Do the assigned task.');
    } finally {
      if (previousTeamWorker === undefined) {
        delete process.env.OMP_TEAM_WORKER;
      } else {
        process.env.OMP_TEAM_WORKER = previousTeamWorker;
      }
      if (previousWorkerCli === undefined) {
        delete process.env.OMP_TEAM_WORKER_CLI;
      } else {
        process.env.OMP_TEAM_WORKER_CLI = previousWorkerCli;
      }
      removeDir(tempRoot);
    }
  });

  test('truncates oversized context before invoking Gemini prompt mode', async () => {
    const tempRoot = createTempDir('omp-worker-gemini-large-');
    const ioCapture = createIoCapture();
    let observedPrompt = '';

    const previousTeamWorker = process.env.OMP_TEAM_WORKER;
    const previousWorkerCli = process.env.OMP_TEAM_WORKER_CLI;

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'GEMINI.md'),
        'x'.repeat(40_000),
        'utf8',
      );

      process.env.OMP_TEAM_WORKER = 'gemini-team/worker-1';
      process.env.OMP_TEAM_WORKER_CLI = 'gemini';

      const result = await executeWorkerRunCommand([], {
        cwd: tempRoot,
        io: ioCapture.io,
        runGeminiPromptFn: async ({ prompt }) => {
          observedPrompt = prompt;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(observedPrompt.length).toBeLessThan(14_500);
      expect(observedPrompt).toContain('[truncated]');
      expect(observedPrompt).toContain(path.join(tempRoot, '.gemini', 'GEMINI.md'));
    } finally {
      if (previousTeamWorker === undefined) {
        delete process.env.OMP_TEAM_WORKER;
      } else {
        process.env.OMP_TEAM_WORKER = previousTeamWorker;
      }
      if (previousWorkerCli === undefined) {
        delete process.env.OMP_TEAM_WORKER_CLI;
      } else {
        process.env.OMP_TEAM_WORKER_CLI = previousWorkerCli;
      }
      removeDir(tempRoot);
    }
  });

  test('persists structured role-output artifacts when worker identity contract exists', async () => {
    const tempRoot = createTempDir('omp-worker-gemini-role-output-');
    const ioCapture = createIoCapture();
    const stateStore = new TeamStateStore({ cwd: tempRoot });
    let observedPrompt = '';

    const previousTeamWorker = process.env.OMP_TEAM_WORKER;
    const previousWorkerCli = process.env.OMP_TEAM_WORKER_CLI;

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'GEMINI.md'),
        '# worker context\n\nImplement the assigned task.',
        'utf8',
      );

      await stateStore.writeWorkerIdentity({
        teamName: 'gemini-team',
        workerName: 'worker-1',
        role: 'planner',
        updatedAt: new Date().toISOString(),
        metadata: {
          subagentId: 'planner',
          skills: ['plan'],
          primarySkill: 'plan',
          roleArtifactBase: '.omp/state/team/gemini-team/artifacts/roles/worker-1/planner',
          roleArtifactRoot: '.omp/state/team/gemini-team/artifacts/roles',
          signalForwardingMode: 'wrapper-forward',
        },
      });

      process.env.OMP_TEAM_WORKER = 'gemini-team/worker-1';
      process.env.OMP_TEAM_WORKER_CLI = 'gemini';

      const result = await executeWorkerRunCommand([], {
        cwd: tempRoot,
        io: ioCapture.io,
        runGeminiPromptFn: async ({ prompt }) => {
          observedPrompt = prompt;
          return JSON.stringify({
            summary: 'Planned the gemini-spawn rollout.',
            plan: {
              objective: 'Ship gemini-spawn backend',
              steps: [
                'Update backend registry',
                'Implement worker evidence contract',
              ],
            },
          });
        },
      });

      expect(result.exitCode).toBe(0);
      expect(observedPrompt).toContain('Completion Contract');

      const doneSignal = await stateStore.readWorkerDone('gemini-team', 'worker-1');
      expect(doneSignal?.status).toBe('completed');
      expect(doneSignal?.summary).toContain('Planned the gemini-spawn rollout');
      expect(
        (doneSignal?.metadata as Record<string, unknown> | undefined)?.signalForwardingMode,
      ).toBe('wrapper-forward');

      const roleOutputPath = path.join(
        tempRoot,
        '.omp',
        'state',
        'team',
        'gemini-team',
        'artifacts',
        'roles',
        'worker-1',
        'planner.json',
      );
      const roleOutputRaw = await fs.readFile(roleOutputPath, 'utf8');
      const roleOutput = JSON.parse(roleOutputRaw) as {
        summary?: string;
        plan?: { steps?: string[] };
      };
      expect(roleOutput.summary).toBe('Planned the gemini-spawn rollout.');
      expect(roleOutput.plan?.steps).toStrictEqual([
        'Update backend registry',
        'Implement worker evidence contract',
      ]);
    } finally {
      if (previousTeamWorker === undefined) {
        delete process.env.OMP_TEAM_WORKER;
      } else {
        process.env.OMP_TEAM_WORKER = previousTeamWorker;
      }
      if (previousWorkerCli === undefined) {
        delete process.env.OMP_TEAM_WORKER_CLI;
      } else {
        process.env.OMP_TEAM_WORKER_CLI = previousWorkerCli;
      }
      removeDir(tempRoot);
    }
  });
});
