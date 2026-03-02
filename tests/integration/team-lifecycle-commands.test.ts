import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  cliEntrypointExists,
  createTempDir,
  removeDir,
  runOmg,
} from '../utils/runtime.js';

interface TeamLifecycleJsonOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

function parseJsonFromStdout(stdout: string): TeamLifecycleJsonOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Expected JSON output but stdout was empty.');
  }

  return JSON.parse(trimmed) as TeamLifecycleJsonOutput;
}

describe('integration: team lifecycle commands', () => {
  test.runIf(cliEntrypointExists())(
    'status/resume/shutdown commands operate on persisted state contracts',
    async () => {
      const tempRoot = createTempDir('omg-team-lifecycle-integration-');
      const teamName = 'integration-lifecycle';
      const now = new Date().toISOString();

      try {
        const teamDir = path.join(tempRoot, '.omg', 'state', 'team', teamName);
        const eventsDir = path.join(teamDir, 'events');

        await fs.mkdir(eventsDir, { recursive: true });

        await fs.writeFile(
          path.join(teamDir, 'run-request.json'),
          JSON.stringify(
            {
              schemaVersion: 1,
              teamName,
              task: 'integration-lifecycle-resume-task',
              backend: 'tmux',
              workers: 2,
              maxFixLoop: 1,
              cwd: tempRoot,
              updatedAt: now,
            },
            null,
            2,
          ),
          'utf8',
        );

        await fs.writeFile(
          path.join(teamDir, 'phase.json'),
          JSON.stringify(
            {
              teamName,
              runId: 'run-integration-lifecycle-1',
              currentPhase: 'exec',
              maxFixAttempts: 1,
              currentFixAttempt: 0,
              transitions: [],
              updatedAt: now,
            },
            null,
            2,
          ),
          'utf8',
        );

        await fs.writeFile(
          path.join(teamDir, 'monitor-snapshot.json'),
          JSON.stringify(
            {
              runId: 'run-integration-lifecycle-1',
              teamName,
              handleId: 'handle-integration-lifecycle-1',
              backend: 'tmux',
              status: 'running',
              updatedAt: now,
              workers: [],
              runtime: {},
            },
            null,
            2,
          ),
          'utf8',
        );

        const statusResult = runOmg(
          ['team', 'status', '--team', teamName, '--json'],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect(statusResult.status, statusResult.stderr).toBe(0);
        const statusOutput = parseJsonFromStdout(statusResult.stdout);
        expect(statusOutput.exitCode).toBe(0);
        expect(statusOutput.details?.teamName).toBe(teamName);
        expect(statusOutput.details?.runtimeStatus).toBe('running');

        const resumeResult = runOmg(
          ['team', 'resume', '--team', teamName, '--json'],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect([0, 1]).toContain(resumeResult.status);
        const resumeOutput = parseJsonFromStdout(resumeResult.stdout);
        expect([0, 1]).toContain(resumeOutput.exitCode);
        expect(resumeOutput.details?.teamName).toBe(teamName);

        const shutdownResult = runOmg(
          ['team', 'shutdown', '--team', teamName, '--force', '--json'],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect(shutdownResult.status, shutdownResult.stderr).toBe(0);
        const shutdownOutput = parseJsonFromStdout(shutdownResult.stdout);
        expect(shutdownOutput.exitCode).toBe(0);

        const snapshotPath = path.join(teamDir, 'monitor-snapshot.json');
        expect(existsSync(snapshotPath)).toBe(true);

        const snapshot = JSON.parse(
          await fs.readFile(snapshotPath, 'utf8'),
        ) as {
          status?: string;
          runtime?: { shutdownForce?: boolean };
        };

        expect(snapshot.status).toBe('stopped');
        expect(snapshot.runtime?.shutdownForce).toBe(true);
      } finally {
        removeDir(tempRoot);
      }
    },
  );
});
