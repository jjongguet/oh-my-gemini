import { describe, expect, test } from 'vitest';

import {
  isUnixLikeOnWindows,
  quoteShellArg,
  resolveDefaultShell,
  resolveShellAdapter,
  wrapWithLoginShell,
} from '../../src/platform/index.js';

describe('reliability: platform shell adapter', () => {
  test('isUnixLikeOnWindows checks MSYS/MINGW env toggles', () => {
    expect(isUnixLikeOnWindows({})).toBe(false);
    expect(isUnixLikeOnWindows({ MSYSTEM: 'MINGW64' })).toBe(true);
    expect(isUnixLikeOnWindows({ MINGW_PREFIX: '/mingw64' })).toBe(true);
  });

  test('resolveDefaultShell uses SHELL on unix-like and COMSPEC on native windows', () => {
    expect(
      resolveDefaultShell({
        platform: 'linux',
        env: { SHELL: '/bin/zsh' },
      }),
    ).toBe('/bin/zsh');

    expect(
      resolveDefaultShell({
        platform: 'win32',
        env: { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' },
      }),
    ).toBe('C:\\Windows\\System32\\cmd.exe');

    expect(
      resolveDefaultShell({
        platform: 'win32',
        env: { SHELL: '/usr/bin/bash', MSYSTEM: 'MINGW64' },
      }),
    ).toBe('/usr/bin/bash');
  });

  test('resolveShellAdapter picks posix or cmd adapter by platform', () => {
    expect(resolveShellAdapter({ platform: 'linux', env: {} }).kind).toBe('posix');
    expect(resolveShellAdapter({ platform: 'win32', env: {} }).kind).toBe('cmd');
    expect(
      resolveShellAdapter({
        platform: 'win32',
        env: { MSYSTEM: 'MINGW64', SHELL: '/usr/bin/bash' },
      }).kind,
    ).toBe('posix');
  });

  test('quoteShellArg sanitizes control chars and escapes apostrophes for posix', () => {
    const escaped = quoteShellArg("line1\nline2\r\0it's", {
      platform: 'linux',
      env: { SHELL: '/bin/bash' },
    });

    expect(escaped).toBe(`'line1line2it'"'"'s'`);
  });

  test('quoteShellArg double-quotes and escapes quotes for cmd', () => {
    const escaped = quoteShellArg('say "hello"\nnext', {
      platform: 'win32',
      env: { COMSPEC: 'cmd.exe' },
    });

    expect(escaped).toBe('"say ""hello""next"');
  });

  test('wrapWithLoginShell builds login shell command for posix shells', () => {
    const wrapped = wrapWithLoginShell('echo ok', {
      platform: 'linux',
      env: { SHELL: '/bin/zsh', HOME: '/home/tester' },
    });

    expect(wrapped).toContain("exec '/bin/zsh' -lc");
    expect(wrapped).toContain('/home/tester/.zshrc');
    expect(wrapped).toContain('echo ok');
  });

  test('wrapWithLoginShell builds cmd invocation on native windows', () => {
    const wrapped = wrapWithLoginShell('echo ok', {
      platform: 'win32',
      env: { COMSPEC: 'cmd.exe' },
    });

    expect(wrapped).toBe('cmd.exe /d /s /c "echo ok"');
  });
});
