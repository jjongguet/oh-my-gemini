import { basename } from 'node:path';

import { PLATFORM, isWindows } from './os.js';

export type ShellAdapterKind = 'posix' | 'cmd';

export interface ShellResolutionOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  shellPath?: string;
  adapter?: ShellAdapterKind;
}

export interface ShellAdapter {
  kind: ShellAdapterKind;
  shellPath: string;
  quoteArg: (value: string) => string;
}

function sanitizeShellValue(value: string): string {
  return value.replace(/[\x00\r\n]/g, '');
}

function quotePosixArg(value: string): string {
  const sanitized = sanitizeShellValue(value);
  return `'${sanitized.replace(/'/g, `'"'"'`)}'`;
}

function quoteCmdArg(value: string): string {
  const sanitized = sanitizeShellValue(value);
  return `"${sanitized.replace(/"/g, '""')}"`;
}

function resolveAdapterKind(options: ShellResolutionOptions): ShellAdapterKind {
  if (options.adapter) {
    return options.adapter;
  }

  const platform = options.platform ?? PLATFORM;
  if (!isWindows(platform)) {
    return 'posix';
  }

  return isUnixLikeOnWindows(options.env) ? 'posix' : 'cmd';
}

/**
 * True when running on Windows under MSYS2/Git Bash where panes are Unix-like.
 */
export function isUnixLikeOnWindows(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.MSYSTEM || env.MINGW_PREFIX);
}

/**
 * Resolve default shell path for current platform/runtime.
 */
export function resolveDefaultShell(
  options: Omit<ShellResolutionOptions, 'adapter'> = {},
): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? PLATFORM;

  if (options.shellPath) {
    return options.shellPath;
  }

  if (isWindows(platform) && !isUnixLikeOnWindows(env)) {
    return env.COMSPEC || 'cmd.exe';
  }

  return env.SHELL || '/bin/bash';
}

export function resolveShellAdapter(options: ShellResolutionOptions = {}): ShellAdapter {
  const kind = resolveAdapterKind(options);
  const shellPath = resolveDefaultShell(options);
  return {
    kind,
    shellPath,
    quoteArg: kind === 'cmd' ? quoteCmdArg : quotePosixArg,
  };
}

export function quoteShellArg(
  value: string,
  options: ShellResolutionOptions = {},
): string {
  return resolveShellAdapter(options).quoteArg(value);
}

/**
 * Wrap a command in a login shell with RC file sourcing when available.
 */
export function wrapWithLoginShell(
  command: string,
  options: Omit<ShellResolutionOptions, 'adapter'> = {},
): string {
  const adapter = resolveShellAdapter(options);

  if (adapter.kind === 'cmd') {
    return `${adapter.shellPath} /d /s /c ${quoteShellArg(command, {
      ...options,
      adapter: 'cmd',
    })}`;
  }

  const shellName = basename(adapter.shellPath).replace(/\.(exe|cmd|bat)$/i, '');
  const home = (options.env ?? process.env).HOME;
  const rcFile = home ? `${home}/.${shellName}rc` : undefined;
  const sourcePrefix = rcFile
    ? `[ -f ${quoteShellArg(rcFile, { ...options, adapter: 'posix' })} ] && . ${quoteShellArg(rcFile, {
        ...options,
        adapter: 'posix',
      })}; `
    : '';

  return `exec ${quoteShellArg(adapter.shellPath, {
    ...options,
    adapter: 'posix',
  })} -lc ${quoteShellArg(`${sourcePrefix}${command}`, {
    ...options,
    adapter: 'posix',
  })}`;
}
