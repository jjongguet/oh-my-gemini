import { describe, expect, test } from 'vitest';

import { runCli } from '../../src/cli/index.js';
import { executeHudCommand } from '../../src/cli/commands/hud.js';
import type { CliIo } from '../../src/cli/types.js';
import type { HudRenderContext } from '../../src/hud/index.js';

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

function createHudContext(): HudRenderContext {
  return {
    version: '0.1.0',
    gitBranch: 'oh-my-gemini/dev',
    generatedAt: '2026-03-05T00:00:00.000Z',
    team: {
      teamName: 'oh-my-gemini',
      hasState: true,
      phase: 'exec',
      runtimeStatus: 'running',
      updatedAt: '2026-03-05T00:00:00.000Z',
      tasks: {
        total: 10,
        completed: 6,
        inProgress: 2,
        percent: 60,
      },
      workers: {
        total: 3,
        running: 1,
        done: 2,
        failed: 0,
        percent: 67,
      },
    },
    gemini: {
      model: 'gemini-2.5-pro',
      keySource: 'env',
      windowPercent: 42,
      quotaPercent: 55,
      updatedAt: '2026-03-05T00:00:00.000Z',
    },
  };
}

describe('reliability: hud command', () => {
  test('prints help', async () => {
    const ioCapture = createIoCapture();

    const result = await executeHudCommand(['--help'], {
      cwd: process.cwd(),
      env: process.env,
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omg hud/i);
  });

  test('fails with usage error for unknown option', async () => {
    const ioCapture = createIoCapture();

    const result = await executeHudCommand(['--bogus'], {
      cwd: process.cwd(),
      env: process.env,
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unknown option\(s\): --bogus/i);
  });

  test('fails with usage error for invalid preset', async () => {
    const ioCapture = createIoCapture();

    const result = await executeHudCommand(['--preset', 'unknown'], {
      cwd: process.cwd(),
      env: process.env,
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Invalid --preset value/i);
  });

  test('prints raw HUD context when --json is set', async () => {
    const ioCapture = createIoCapture();
    const expected = createHudContext();

    const result = await executeHudCommand(['--json'], {
      cwd: process.cwd(),
      env: process.env,
      io: ioCapture.io,
      readHudContextFn: async () => expected,
      readHudConfigFn: async () => ({ preset: 'focused' }),
      renderHudFn: () => 'unused',
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(JSON.parse(ioCapture.stdout.join('\n'))).toStrictEqual(expected);
  });

  test('renders HUD with config preset and allows explicit override', async () => {
    const ioCapture = createIoCapture();
    const observedPresets: string[] = [];

    const first = await executeHudCommand([], {
      cwd: process.cwd(),
      env: process.env,
      io: ioCapture.io,
      readHudContextFn: async () => createHudContext(),
      readHudConfigFn: async () => ({ preset: 'focused' }),
      renderHudFn: (_context, preset) => {
        observedPresets.push(preset);
        return `rendered:${preset}`;
      },
    });

    const second = await executeHudCommand(['--preset', 'minimal'], {
      cwd: process.cwd(),
      env: process.env,
      io: ioCapture.io,
      readHudContextFn: async () => createHudContext(),
      readHudConfigFn: async () => ({ preset: 'focused' }),
      renderHudFn: (_context, preset) => {
        observedPresets.push(preset);
        return `rendered:${preset}`;
      },
    });

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(observedPresets).toStrictEqual(['focused', 'minimal']);
    expect(ioCapture.stdout).toContain('rendered:focused');
    expect(ioCapture.stdout).toContain('rendered:minimal');
  });

  test('runCli dispatches hud command', async () => {
    const ioCapture = createIoCapture();

    const exitCode = await runCli(['hud', '--json'], {
      io: ioCapture.io,
      hud: {
        readHudContextFn: async () => createHudContext(),
        readHudConfigFn: async () => ({ preset: 'focused' }),
        renderHudFn: () => 'unused',
      },
    });

    expect(exitCode).toBe(0);
    const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
      team: { teamName: string };
      gemini: { model: string };
    };
    expect(payload.team.teamName).toBe('oh-my-gemini');
    expect(payload.gemini.model).toBe('gemini-2.5-pro');
  });
});
