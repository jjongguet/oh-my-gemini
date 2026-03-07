import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { executeWorkerRunCommand } from '../../src/cli/commands/worker-run.js';
import type { CliIo } from '../../src/cli/types.js';
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
  test('runs Gemini prompt mode when OMG_TEAM_WORKER_CLI=gemini', async () => {
    const tempRoot = createTempDir('omg-worker-gemini-');
    const ioCapture = createIoCapture();
    let observedPrompt = '';

    const previousTeamWorker = process.env.OMG_TEAM_WORKER;
    const previousWorkerCli = process.env.OMG_TEAM_WORKER_CLI;

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'GEMINI.md'),
        '# worker context\n\nDo the assigned task.',
        'utf8',
      );

      process.env.OMG_TEAM_WORKER = 'gemini-team/worker-1';
      process.env.OMG_TEAM_WORKER_CLI = 'gemini';

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
        delete process.env.OMG_TEAM_WORKER;
      } else {
        process.env.OMG_TEAM_WORKER = previousTeamWorker;
      }
      if (previousWorkerCli === undefined) {
        delete process.env.OMG_TEAM_WORKER_CLI;
      } else {
        process.env.OMG_TEAM_WORKER_CLI = previousWorkerCli;
      }
      removeDir(tempRoot);
    }
  });

  test('truncates oversized context before invoking Gemini prompt mode', async () => {
    const tempRoot = createTempDir('omg-worker-gemini-large-');
    const ioCapture = createIoCapture();
    let observedPrompt = '';

    const previousTeamWorker = process.env.OMG_TEAM_WORKER;
    const previousWorkerCli = process.env.OMG_TEAM_WORKER_CLI;

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'GEMINI.md'),
        'x'.repeat(40_000),
        'utf8',
      );

      process.env.OMG_TEAM_WORKER = 'gemini-team/worker-1';
      process.env.OMG_TEAM_WORKER_CLI = 'gemini';

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
        delete process.env.OMG_TEAM_WORKER;
      } else {
        process.env.OMG_TEAM_WORKER = previousTeamWorker;
      }
      if (previousWorkerCli === undefined) {
        delete process.env.OMG_TEAM_WORKER_CLI;
      } else {
        process.env.OMG_TEAM_WORKER_CLI = previousWorkerCli;
      }
      removeDir(tempRoot);
    }
  });
});
