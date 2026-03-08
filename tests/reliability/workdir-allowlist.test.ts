import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { promises as fs } from 'node:fs';

import { executeTeamResumeCommand } from '../../src/cli/commands/team-resume.js';
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

describe('reliability: workdir allowlist', () => {
  test('team resume dry-run rejects persisted cwd outside the invocation root by default', async () => {
    const tempRoot = createTempDir('omg-workdir-allowlist-');
    const externalRoot = createTempDir('omg-workdir-external-');
    const ioCapture = createIoCapture();

    try {
      const runRequestPath = path.join(tempRoot, '.omg', 'state', 'team', 'demo-team', 'run-request.json');
      await fs.mkdir(path.dirname(runRequestPath), { recursive: true });
      await fs.writeFile(
        runRequestPath,
        JSON.stringify({
          schemaVersion: 1,
          teamName: 'demo-team',
          task: 'resume task',
          backend: 'tmux',
          workers: 1,
          maxFixLoop: 1,
          cwd: externalRoot,
          updatedAt: new Date('2026-03-02T00:00:00.000Z').toISOString(),
        }, null, 2),
        'utf8',
      );

      const result = await executeTeamResumeCommand(['--team', 'demo-team', '--dry-run'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(1);
      expect(ioCapture.stdout.join('\n')).toMatch(/outside the allowed workdir roots/i);
    } finally {
      removeDir(tempRoot);
      removeDir(externalRoot);
    }
  });

  test('team resume dry-run accepts persisted cwd when explicitly allowlisted', async () => {
    const previousAllowlist = process.env.OMG_WORKDIR_ALLOWLIST;
    const tempRoot = createTempDir('omg-workdir-allowlist-pass-');
    const externalRoot = createTempDir('omg-workdir-allowlist-external-pass-');
    const ioCapture = createIoCapture();

    try {
      process.env.OMG_WORKDIR_ALLOWLIST = externalRoot;
      const runRequestPath = path.join(tempRoot, '.omg', 'state', 'team', 'demo-team', 'run-request.json');
      await fs.mkdir(path.dirname(runRequestPath), { recursive: true });
      await fs.writeFile(
        runRequestPath,
        JSON.stringify({
          schemaVersion: 1,
          teamName: 'demo-team',
          task: 'resume task',
          backend: 'tmux',
          workers: 1,
          maxFixLoop: 1,
          cwd: externalRoot,
          updatedAt: new Date('2026-03-02T00:00:00.000Z').toISOString(),
        }, null, 2),
        'utf8',
      );

      const result = await executeTeamResumeCommand(
        ['--team', 'demo-team', '--dry-run', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);
      const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
        details?: { cwd?: string };
      };
      expect(payload.details?.cwd).toBe(externalRoot);
    } finally {
      if (previousAllowlist === undefined) {
        delete process.env.OMG_WORKDIR_ALLOWLIST;
      } else {
        process.env.OMG_WORKDIR_ALLOWLIST = previousAllowlist;
      }
      removeDir(tempRoot);
      removeDir(externalRoot);
    }
  });
});
