import { describe, expect, test } from 'vitest';

import {
  executeTeamRunCommand,
  runTeamCommand,
} from '../../src/cli/commands/team-run.js';
import { DEFAULT_WORKERS, MAX_WORKERS } from '../../src/team/constants.js';
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
      input?: { backend: string; subagents?: string[]; workers: number };
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
            workers: input.workers,
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
    expect(resolvedInput.workers).toBe(2);
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('auto-selects subagents backend when --subagents is provided without --backend', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; workers: number };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        'ship-phase-c',
        '--subagents',
        'planner,executor',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
            workers: input.workers,
          };
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.input?.backend).toBe('subagents');
    expect(observed.input?.subagents).toStrictEqual(['planner', 'executor']);
    expect(observed.input?.workers).toBe(2);
  });

  test('passes explicit subagent list to runner for gemini-spawn backend', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; workers: number };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        'ship-phase-c',
        '--backend',
        'gemini-spawn',
        '--subagents',
        'planner,executor',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
            workers: input.workers,
          };
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.input?.backend).toBe('gemini-spawn');
    expect(observed.input?.subagents).toStrictEqual(['planner', 'executor']);
    expect(observed.input?.workers).toBe(2);
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
      /only supported when --backend subagents or --backend gemini-spawn/i,
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
      input?: { backend: string; subagents?: string[]; task: string; workers: number };
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
            workers: input.workers,
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
    expect(resolvedInput.workers).toBe(2);
    expect(resolvedInput.task).toBe('implement deterministic phase-c flow');
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('auto-selects gemini-spawn backend from leading /gemini keyword', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; task: string; workers: number };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/gemini $planner /executor implement headless worker flow',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
            task: input.task,
            workers: input.workers,
          };
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.input?.backend).toBe('gemini-spawn');
    expect(observed.input?.subagents).toStrictEqual(['planner', 'executor']);
    expect(observed.input?.workers).toBe(2);
    expect(observed.input?.task).toBe('implement headless worker flow');
  });

  test('dedupes alias-style keyword assignments while preserving order', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; workers: number; task: string };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        '$plan /execute /plan implement deterministic alias parsing',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
            workers: input.workers,
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
    expect(observed.input?.backend).toBe('subagents');
    expect(observed.input?.subagents).toStrictEqual(['plan', 'execute']);
    expect(observed.input?.workers).toBe(2);
    expect(observed.input?.task).toBe('implement deterministic alias parsing');
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('does not treat /prompts:* tokens as backend or role keywords', async () => {
    const ioCapture = createIoCapture();
    const observed: { input?: { backend: string; task: string; workers: number } } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/prompts:architect review auth boundary',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            task: input.task,
            workers: input.workers,
          };
          return { exitCode: 0, message: 'ok' };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.input?.backend).toBe('tmux');
    expect(observed.input?.task).toBe('/prompts:architect review auth boundary');
    expect(observed.input?.workers).toBe(DEFAULT_WORKERS);
  });

  test('auto-selects tmux backend from leading /tmux keyword', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; task: string; workers: number };
    } = {};

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/tmux run deterministic tmux flow',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.input = {
            backend: input.backend,
            subagents: input.subagents,
            task: input.task,
            workers: input.workers,
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

    expect(resolvedInput.backend).toBe('tmux');
    expect(resolvedInput.subagents).toBeUndefined();
    expect(resolvedInput.workers).toBe(DEFAULT_WORKERS);
    expect(resolvedInput.task).toBe('run deterministic tmux flow');
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('rejects conflicting backend keywords in task prefix', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/tmux /subagents smoke',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/conflicting backend keywords/i);
  });

  test('rejects conflict between explicit backend and backend keyword', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/tmux smoke',
        '--backend',
        'subagents',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/backend conflict/i);
  });

  test('rejects subagent role tags when /tmux backend keyword is used', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        '/tmux $planner stay deterministic',
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

  test('merges explicit --subagents and leading keyword assignments', async () => {
    const ioCapture = createIoCapture();
    const observed: {
      input?: { backend: string; subagents?: string[]; workers: number };
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
            workers: input.workers,
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
    expect(resolvedInput.workers).toBe(2);
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

  test('tmux backend uses default workers when --workers is omitted', async () => {
    const ioCapture = createIoCapture();
    const observed: { workers?: number } = {};

    const result = await executeTeamRunCommand(
      ['--task', 'plain tmux run'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
        teamRunner: async (input) => {
          observed.workers = input.workers;
          return {
            exitCode: 0,
            message: 'ok',
          };
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(observed.workers).toBe(DEFAULT_WORKERS);
  });

  test('rejects invalid --workers value', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      ['--task', 'plain tmux run', '--workers', '0'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --workers/i);
  });

  test('rejects mismatch between --workers and resolved subagent assignments', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        '$planner /executor mismatch case',
        '--workers',
        '3',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/worker mismatch/i);
  });

  test('rejects derived subagent assignment count above worker cap', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      [
        '--task',
        '$a /b $c /d $e /f $g /h $i over worker cap',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(
      new RegExp(`expected integer 1\\.\\.${MAX_WORKERS}`, 'i'),
    );
  });

  test('requires --task and rejects positional-only task input', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      ['plain', 'positional', 'task'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/unexpected positional arguments/i);
  });

  test('rejects unknown options with usage exit code', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      ['--task', 'smoke', '--bogus-option', 'x'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/unknown option/i);
    expect(ioCapture.stderr.join('\n')).toMatch(/--bogus-option/i);
  });

  test('rejects unsafe team identifiers that can escape team namespace', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      ['--task', 'smoke', '--team', '..'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --team value/i);
  });

  test('runTeamCommand rejects unsafe team identifiers in direct runner usage', async () => {
    const result = await runTeamCommand({
      teamName: '..',
      task: 'smoke',
      backend: 'tmux',
      workers: DEFAULT_WORKERS,
      maxFixLoop: 0,
      dryRun: true,
      cwd: process.cwd(),
    });

    expect(result.exitCode).toBe(1);
    expect(result.message).toMatch(/failed to persist run request/i);
    expect(result.details?.teamName).toBe('..');
  });

  test('rejects --max-fix-loop above default cap', async () => {
    const ioCapture = createIoCapture();

    const result = await executeTeamRunCommand(
      ['--task', 'smoke', '--max-fix-loop', '4'],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/invalid --max-fix-loop/i);
    expect(ioCapture.stderr.join('\n')).toMatch(/0\.\.3/i);
  });
});
