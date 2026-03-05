import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  getProcessStartTime,
  gracefulKill,
  isPathRoot,
  isProcessAlive,
  isWsl,
} from '../../src/platform/index.js';

describe('reliability: feature platform module', () => {
  test('isPathRoot detects platform root paths', () => {
    const unixRoot = '/';
    expect(isPathRoot(unixRoot)).toBe(true);

    const systemRoot = path.parse(process.cwd()).root;
    expect(isPathRoot(systemRoot)).toBe(true);
    expect(isPathRoot(path.join(systemRoot, 'tmp'))).toBe(false);
  });

  test('isWsl returns a boolean without throwing', () => {
    expect(typeof isWsl()).toBe('boolean');
  });

  test('getProcessStartTime supports current process pid', async () => {
    const startedAt = await getProcessStartTime(process.pid);
    if (startedAt !== undefined) {
      expect(typeof startedAt).toBe('number');
      expect(Number.isFinite(startedAt)).toBe(true);
    }
  });

  test('gracefulKill terminates spawned process trees', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });

    child.unref();

    const pid = child.pid;
    expect(pid).toBeTypeOf('number');
    if (pid === undefined) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isProcessAlive(pid)).toBe(true);

    const result = await gracefulKill(pid, 2_000);
    expect(['graceful', 'forced']).toContain(result);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isProcessAlive(pid)).toBe(false);
  });
});
