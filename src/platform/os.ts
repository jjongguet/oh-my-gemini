import path from 'node:path';
import { readFileSync } from 'node:fs';

export const PLATFORM = process.platform;

export function isWindows(platform: NodeJS.Platform = PLATFORM): boolean {
  return platform === 'win32';
}

export function isMacOS(platform: NodeJS.Platform = PLATFORM): boolean {
  return platform === 'darwin';
}

export function isLinux(platform: NodeJS.Platform = PLATFORM): boolean {
  return platform === 'linux';
}

export function isUnix(platform: NodeJS.Platform = PLATFORM): boolean {
  return isMacOS(platform) || isLinux(platform);
}

/**
 * Check if a path resolves to a filesystem root.
 * Supports both POSIX (/) and Windows drive roots (C:\\).
 */
export function isPathRoot(filepath: string): boolean {
  if (!filepath) {
    return false;
  }

  const posixRoot = path.posix.parse(filepath).root;
  if (filepath === posixRoot) {
    return true;
  }

  const windowsRoot = path.win32.parse(filepath).root;
  return filepath === windowsRoot;
}

export interface WslDetectionOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  readProcVersion?: () => string;
}

/**
 * Detect whether current process is running inside Windows Subsystem for Linux.
 */
export function isWSL(options: WslDetectionOptions = {}): boolean {
  const platform = options.platform ?? PLATFORM;
  if (platform !== 'linux') {
    return false;
  }

  const env = options.env ?? process.env;
  if (env.WSLENV !== undefined || env.WSL_DISTRO_NAME !== undefined) {
    return true;
  }

  const readProcVersion =
    options.readProcVersion ?? (() => readFileSync('/proc/version', 'utf8'));

  try {
    const procVersion = readProcVersion();
    return procVersion.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}
