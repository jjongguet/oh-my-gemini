import { describe, expect, test } from 'vitest';

import { executeTeamResumeCommand } from '../../src/cli/commands/team-resume.js';
import { persistTeamRunRequest } from '../../src/cli/commands/team-command-shared.js';
import type { CliIo } from '../../src/cli/types.js';
import type { TeamResumeInput } from '../../src/cli/commands/team-resume.js';
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

describe('reliability: team resume command', () => {
  test('prints help', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamResumeCommand(['--help'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omp team resume/i);
  });

  test('returns usage error for invalid max-fix-loop value', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamResumeCommand(
      ['--max-fix-loop', '99'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Invalid --max-fix-loop value/i);
  });

  test('returns usage error for unsafe team identifier', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamResumeCommand(
      ['--team', '..'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --team value/i);
  });

  test('returns actionable failure when run request is missing', async () => {
    const tempRoot = createTempDir('omp-team-resume-missing-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeTeamResumeCommand(
        ['--team', 'missing-team'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(1);
      expect(ioCapture.stdout.join('\n')).toMatch(
        /(No run request state found|no persisted monitor snapshot)/i,
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('dry-run path is actionable (supported or explicit usage error)', async () => {
    const tempRoot = createTempDir('omp-team-resume-dry-run-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'resume-team';
      await persistTeamRunRequest({
        teamName,
        task: 'resume regression fix',
        backend: 'subagents',
        workers: 2,
        subagents: ['planner', 'executor'],
        maxFixLoop: 1,
        watchdogMs: 60000,
        nonReportingMs: 120000,
        cwd: tempRoot,
      });

      const result = await executeTeamResumeCommand(
        ['--team', teamName, '--dry-run', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      if (result.exitCode === 0) {
        const output = JSON.parse(ioCapture.stdout.join('\n')) as {
          exitCode: number;
          details?: {
            backend?: string;
            workers?: number;
            subagents?: string[];
            task?: string;
          };
        };

        expect(output.exitCode).toBe(0);
        expect(output.details?.backend).toBe('subagents');
        expect(output.details?.workers).toBe(2);
        expect(output.details?.subagents).toStrictEqual(['planner', 'executor']);
        expect(output.details?.task).toBe('resume regression fix');
        return;
      }

      expect([1, 2]).toContain(result.exitCode);
      const combinedOutput = [
        ioCapture.stdout.join('\n'),
        ioCapture.stderr.join('\n'),
      ].join('\n');
      expect(combinedOutput.trim().length).toBeGreaterThan(0);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('dry-run preserves gemini-spawn backend and subagent assignments', async () => {
    const tempRoot = createTempDir('omp-team-resume-gemini-spawn-');
    const ioCapture = createIoCapture();

    try {
      const teamName = 'resume-gemini-spawn-team';
      await persistTeamRunRequest({
        teamName,
        task: 'resume headless gemini workers',
        backend: 'gemini-spawn',
        workers: 2,
        subagents: ['planner', 'executor'],
        maxFixLoop: 1,
        cwd: tempRoot,
      });

      const result = await executeTeamResumeCommand(
        ['--team', teamName, '--dry-run', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(ioCapture.stdout.join('\n')) as {
        exitCode: number;
        details?: {
          backend?: string;
          workers?: number;
          subagents?: string[];
        };
      };

      expect(output.exitCode).toBe(0);
      expect(output.details?.backend).toBe('gemini-spawn');
      expect(output.details?.workers).toBe(2);
      expect(output.details?.subagents).toStrictEqual(['planner', 'executor']);
    } finally {
      removeDir(tempRoot);
    }
  });


  test('parses options and forwards normalized input to injected runner', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      teamName?: string;
      maxFixLoop?: number;
      watchdogMs?: number;
      nonReportingMs?: number;
      dryRun?: boolean;
    } = {};

    const result = await executeTeamResumeCommand(
      [
        '--team',
        'My Team',
        '--max-fix-loop',
        '2',
        '--watchdog-ms',
        '90000',
        '--non-reporting-ms',
        '120000',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        resumeRunner: async (input: TeamResumeInput) => {
          observed.teamName = input.teamName;
          observed.maxFixLoop = input.maxFixLoop;
          observed.watchdogMs = input.watchdogMs;
          observed.nonReportingMs = input.nonReportingMs;
          observed.dryRun = input.dryRun;
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.teamName).toBe('my-team');
    expect(observed.maxFixLoop).toBe(2);
    expect(observed.watchdogMs).toBe(90000);
    expect(observed.nonReportingMs).toBe(120000);
    expect(observed.dryRun).toBe(false);
  });
});
