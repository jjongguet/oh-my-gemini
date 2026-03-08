import { realpathSync } from 'node:fs';
import path from 'node:path';

const WORKDIR_ALLOWLIST_ENV_VARS = [
  'OMG_WORKDIR_ALLOWLIST',
  'OMX_WORKDIR_ALLOWLIST',
] as const;

function resolveRealpath(inputPath: string): string {
  try {
    return realpathSync.native(inputPath);
  } catch {
    return path.resolve(inputPath);
  }
}

export function canonicalizeWorkdir(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error('Workdir cannot be empty.');
  }

  if (trimmed.includes('\0')) {
    throw new Error('Workdir cannot contain null bytes.');
  }

  return resolveRealpath(trimmed);
}

function isWithinRoot(candidate: string, allowedRoot: string): boolean {
  return candidate === allowedRoot || candidate.startsWith(`${allowedRoot}${path.sep}`);
}

function readConfiguredAllowlist(env: NodeJS.ProcessEnv): string[] {
  const entries: string[] = [];

  for (const key of WORKDIR_ALLOWLIST_ENV_VARS) {
    const rawValue = env[key];
    if (!rawValue) {
      continue;
    }

    for (const part of rawValue.split(path.delimiter)) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      entries.push(canonicalizeWorkdir(trimmed));
    }
  }

  return entries;
}

export function getAllowedWorkdirRoots(
  baseCwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const roots = [canonicalizeWorkdir(baseCwd), ...readConfiguredAllowlist(env)];
  return [...new Set(roots)];
}

export function assertAllowedWorkdir(
  candidateCwd: string,
  options: {
    baseCwd: string;
    env?: NodeJS.ProcessEnv;
    label?: string;
  },
): string {
  const candidate = canonicalizeWorkdir(candidateCwd);
  const allowedRoots = getAllowedWorkdirRoots(options.baseCwd, options.env ?? process.env);

  if (allowedRoots.some((allowedRoot) => isWithinRoot(candidate, allowedRoot))) {
    return candidate;
  }

  const label = options.label ?? 'workdir';
  throw new Error(
    `${label} ${candidate} is outside the allowed workdir roots: ${allowedRoots.join(', ')}. ` +
      `Add an allowed root via ${WORKDIR_ALLOWLIST_ENV_VARS.join(' or ')} if needed.`,
  );
}
