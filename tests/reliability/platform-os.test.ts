import { describe, expect, test } from 'vitest';

import {
  isLinux,
  isMacOS,
  isPathRoot,
  isUnix,
  isWindows,
  isWSL,
} from '../../src/platform/index.js';

describe('reliability: platform OS abstraction', () => {
  test('OS predicates resolve by platform token', () => {
    expect(isWindows('win32')).toBe(true);
    expect(isWindows('linux')).toBe(false);

    expect(isMacOS('darwin')).toBe(true);
    expect(isMacOS('linux')).toBe(false);

    expect(isLinux('linux')).toBe(true);
    expect(isLinux('darwin')).toBe(false);

    expect(isUnix('linux')).toBe(true);
    expect(isUnix('darwin')).toBe(true);
    expect(isUnix('win32')).toBe(false);
  });

  test('isPathRoot supports POSIX and Windows root paths', () => {
    expect(isPathRoot('/')).toBe(true);
    expect(isPathRoot('/tmp')).toBe(false);
    expect(isPathRoot('C:\\')).toBe(true);
    expect(isPathRoot('C:\\Users')).toBe(false);
  });

  test('isWSL resolves from WSL environment variables', () => {
    expect(
      isWSL({
        platform: 'linux',
        env: {
          WSLENV: 'SOME_VAR',
        },
      }),
    ).toBe(true);
  });

  test('isWSL resolves from /proc/version microsoft marker', () => {
    expect(
      isWSL({
        platform: 'linux',
        env: {},
        readProcVersion: () => 'Linux version 5.15.90.1-microsoft-standard-WSL2',
      }),
    ).toBe(true);
  });

  test('isWSL returns false on non-linux and proc read failures', () => {
    expect(
      isWSL({
        platform: 'darwin',
        env: {},
        readProcVersion: () => 'microsoft',
      }),
    ).toBe(false);

    expect(
      isWSL({
        platform: 'linux',
        env: {},
        readProcVersion: () => {
          throw new Error('ENOENT');
        },
      }),
    ).toBe(false);
  });
});
