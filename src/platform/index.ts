import path from 'node:path';
import { readFileSync } from 'node:fs';

export const PLATFORM = process.platform;

export function isWindows(): boolean {
  return PLATFORM === 'win32';
}

export function isMacOS(): boolean {
  return PLATFORM === 'darwin';
}

export function isMacOs(): boolean {
  return isMacOS();
}

export function isLinux(): boolean {
  return PLATFORM === 'linux';
}

export function isUnix(): boolean {
  return isMacOS() || isLinux();
}

export function isPathRoot(inputPath: string): boolean {
  const parsed = path.parse(inputPath);
  return parsed.root === inputPath;
}

export interface WslDetectionOptions {
  checkEnv?: boolean;
  checkProcVersion?: boolean;
}

export function isWSL(options?: WslDetectionOptions): boolean {
  const { checkEnv = true, checkProcVersion = true } = options ?? {};
  
  if (checkEnv && process.env.WSLENV !== undefined) {
    return true;
  }

  if (checkProcVersion) {
    try {
      const procVersion = readFileSync('/proc/version', 'utf8');
      return procVersion.toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }

  return false;
}

export function isWsl(): boolean {
  return isWSL();
}

export * from './process-utils.js';
