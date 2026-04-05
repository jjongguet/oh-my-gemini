import { describe, expect, test } from 'vitest';

import {
  normalizeLaunchArgs,
  type LaunchRunnerInput,
} from '../../src/cli/commands/launch.js';
import { resolveCliInvocation, runCli } from '../../src/cli/index.js';
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

describe('reliability: launch command surface', () => {
  test('resolveCliInvocation treats no-arg and flag-only invocations as launch', () => {
    expect(resolveCliInvocation([])).toStrictEqual({
      command: 'launch',
      launchArgs: [],
    });
    expect(resolveCliInvocation(['--madmax'])).toStrictEqual({
      command: 'launch',
      launchArgs: ['--madmax'],
    });
    expect(resolveCliInvocation(['launch', '--yolo'])).toStrictEqual({
      command: 'launch',
      launchArgs: ['--yolo'],
    });
    expect(resolveCliInvocation(['setup'])).toStrictEqual({
      command: 'setup',
      launchArgs: [],
    });
    expect(resolveCliInvocation(['-v'])).toStrictEqual({
      command: 'version',
      launchArgs: [],
    });
  });

  test('normalizeLaunchArgs maps --madmax to Gemini yolo + sandbox bypass flags', () => {
    expect(normalizeLaunchArgs(['--madmax'])).toStrictEqual(['--sandbox=none', '--yolo']);
    expect(normalizeLaunchArgs(['--madmax', '--model', 'gemini-2.5-pro'])).toStrictEqual([
      '--sandbox=none',
      '--yolo',
      '--model',
      'gemini-2.5-pro',
    ]);
    expect(normalizeLaunchArgs(['--madmax', '--yolo', '--sandbox=none'])).toStrictEqual([
      '--yolo',
      '--sandbox=none',
    ]);
    expect(normalizeLaunchArgs(['--madmax', '--sandbox', 'none'])).toStrictEqual([
      '--yolo',
      '--sandbox',
      'none',
    ]);
  });

  test('normalizeLaunchArgs maps --pro to Gemini model flag for 3.1 pro', () => {
    expect(normalizeLaunchArgs(['--pro'])).toStrictEqual(['-m', 'gemini-3.1-pro-preview']);
    expect(normalizeLaunchArgs(['--pro', '--yolo'])).toStrictEqual(['-m', 'gemini-3.1-pro-preview', '--yolo']);
    // --pro is ignored when explicit model is provided
    expect(normalizeLaunchArgs(['--pro', '-m', 'gemini-2.5-pro'])).toStrictEqual(['-m', 'gemini-2.5-pro']);
    expect(normalizeLaunchArgs(['--pro', '--model', 'gemini-2.5-pro'])).toStrictEqual(['--model', 'gemini-2.5-pro']);
    // --pro + --madmax combo
    expect(normalizeLaunchArgs(['--pro', '--madmax'])).toStrictEqual([
      '--sandbox=none',
      '--yolo',
      '-m',
      'gemini-3.1-pro-preview',
    ]);
  });

  test('help/version precedence wins over launch routing for flag-only invocations', () => {
    expect(resolveCliInvocation(['--help', '--madmax'])).toStrictEqual({
      command: 'help',
      launchArgs: [],
    });
    expect(resolveCliInvocation(['--version', '--madmax'])).toStrictEqual({
      command: 'version',
      launchArgs: [],
    });
  });

  test('runCli dispatches bare omg to interactive launch runner', async () => {
    const ioCapture = createIoCapture();
    let observed: LaunchRunnerInput | undefined;

    const env = { ...process.env };
    delete env.TMUX;

    const exitCode = await runCli([], {
      cwd: process.cwd(),
      env,
      io: ioCapture.io,
      launch: {
        launchRunner: async (input) => {
          observed = input;
          return { exitCode: 0 };
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(observed?.target).toBe('new-tmux-session');
    expect(observed?.sessionName).toMatch(/^omg-/);
    expect(observed?.geminiArgs[0]).toBe('--extensions');
    expect(observed?.geminiArgs[1]).toBe('oh-my-gemini');
    // Default model injected when none specified
    expect(observed?.geminiArgs).toContain('-m');
    expect(observed?.geminiArgs).toContain('gemini-3.1-flash-lite-preview');
  });

  test('runCli launches inside current tmux session and normalizes madmax flags', async () => {
    const ioCapture = createIoCapture();
    let observed: LaunchRunnerInput | undefined;

    const exitCode = await runCli(['--madmax', '--model', 'gemini-2.5-pro'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TMUX: '/tmp/tmux-1000/default,123,0',
      },
      io: ioCapture.io,
      launch: {
        launchRunner: async (input) => {
          observed = input;
          return { exitCode: 0 };
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(ioCapture.stderr).toStrictEqual([]);
    expect(observed?.target).toBe('inside-tmux');
    expect(observed?.sessionName).toBeNull();
    expect(observed?.geminiArgs).toContain('--yolo');
    expect(observed?.geminiArgs).toContain('--sandbox=none');
    expect(observed?.geminiArgs).not.toContain('--madmax');
    expect(observed?.geminiArgs.slice(-2)).toStrictEqual(['--model', 'gemini-2.5-pro']);
  });
});
