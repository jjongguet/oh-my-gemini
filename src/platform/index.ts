import path from 'node:path';
import { readFileSync } from 'node:fs';

export const PLATFORM = process.platform;

export function isWindows(): boolean {
  return PLATFORM === 'win32';
}

export function isMacOs(): boolean {
  return PLATFORM === 'darwin';
}

export function isLinux(): boolean {
  return PLATFORM === 'linux';
}

export function isUnix(): boolean {
  return isMacOs() || isLinux();
}

export function isPathRoot(inputPath: string): boolean {
  const parsed = path.parse(inputPath);
  return parsed.root === inputPath;
}

export function isWsl(): boolean {
  if (process.env.WSLENV !== undefined) {
    return true;
  }

  try {
    const procVersion = readFileSync('/proc/version', 'utf8');
    return procVersion.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

export * from './process-utils.js';
