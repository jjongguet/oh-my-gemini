import { describe, expect, test } from 'vitest';

import { executeTeamRunCommand } from '../../src/cli/commands/team-run.js';
import type { CliIo } from '../../src/cli/types.js';

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

describe('reliability: team run subagent assignment parsing', () => {
  test('passes explicit subagent list to runner for subagents backend', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[] };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        'ship-phase-c',
        '--backend',
        'subagents',
        '--subagents',
        'Planner,executor,planner',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
          };
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.input).toBeDefined();
    const resolvedInput = observed.input;
    expect(resolvedInput).toBeDefined();
    if (!resolvedInput) {
      throw new Error('teamRunner input was not captured');
    }
    expect(resolvedInput.backend).toBe('subagents');
    expect(resolvedInput.subagents).toStrictEqual(['planner', 'executor']);
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('rejects --subagents when tmux backend is selected', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        'ship-phase-c',
        '--backend',
        'tmux',
        '--subagents',
        'planner,executor',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(
      /only supported when --backend subagents/i,
    );
  });

  test('rejects empty --subagents assignment list', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        'ship-phase-c',
        '--backend',
        'subagents',
        '--subagents',
        ',,,',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(
      /expected at least one comma-separated subagent id/i,
    );
  });

  test('auto-selects subagents backend from leading $ or / keywords', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; task: string };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        '$planner /executor implement deterministic phase-c flow',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
            task: input.task,
          };
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    const resolvedInput = observed.input;
    expect(resolvedInput).toBeDefined();
    if (!resolvedInput) {
      throw new Error('teamRunner input was not captured');
    }

    expect(resolvedInput.backend).toBe('subagents');
    expect(resolvedInput.subagents).toStrictEqual(['planner', 'executor']);
    expect(resolvedInput.task).toBe('implement deterministic phase-c flow');
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('merges explicit --subagents and leading keyword assignments', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[] };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/planner verify merged assignment',
        '--backend',
        'subagents',
        '--subagents',
        'executor,planner',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
          };
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    const resolvedInput = observed.input;
    expect(resolvedInput).toBeDefined();
    if (!resolvedInput) {
      throw new Error('teamRunner input was not captured');
    }

    expect(resolvedInput.backend).toBe('subagents');
    expect(resolvedInput.subagents).toStrictEqual(['executor', 'planner']);
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('rejects keyword-based subagent assignment when tmux backend is forced', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        '$planner stay on tmux backend',
        '--backend',
        'tmux',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(
      /only supported when --backend subagents/i,
    );
  });
});
