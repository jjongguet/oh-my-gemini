import path from 'node:path';

import {
  ensureDirectory,
  readJsonFile,
  writeJsonFile,
} from '../../state/filesystem.js';
import { normalizeTeamName } from './team-command-shared.js';
import { canonicalizeWorkdir } from './workdir-security.js';

export type TeamLifecycleBackend = 'tmux' | 'subagents' | 'gemini-spawn';

export interface TeamResumeInputState {
  schemaVersion: 1;
  savedAt: string;
  teamName: string;
  task: string;
  backend: TeamLifecycleBackend;
  workers: number;
  subagents?: string[];
  maxFixLoop: number;
  watchdogMs?: number;
  nonReportingMs?: number;
  cwd: string;
}

interface TeamResumeInputPayload {
  teamName: string;
  task: string;
  backend: TeamLifecycleBackend;
  workers: number;
  subagents?: string[];
  maxFixLoop: number;
  watchdogMs?: number;
  nonReportingMs?: number;
  cwd: string;
}

const RESUME_INPUT_SCHEMA_VERSION = 1;
const RESUME_INPUT_FILE_NAME = 'resume-input.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSubagents(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const normalized = raw
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizePositiveInteger(
  value: unknown,
  label: string,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid persisted ${label}: expected positive integer.`);
  }

  return value;
}

function normalizeNonNegativeInteger(
  value: unknown,
  label: string,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid persisted ${label}: expected non-negative integer.`);
  }

  return value;
}

function normalizeBackend(raw: unknown): TeamLifecycleBackend {
  if (raw === 'tmux' || raw === 'subagents' || raw === 'gemini-spawn') {
    return raw;
  }

  throw new Error('Invalid persisted backend in resume input state.');
}

export function getTeamResumeInputPath(cwd: string, teamName: string): string {
  return path.join(
    canonicalizeWorkdir(cwd),
    '.omp',
    'state',
    'team',
    normalizeTeamName(teamName),
    RESUME_INPUT_FILE_NAME,
  );
}

export async function writeTeamResumeInputState(
  cwd: string,
  payload: TeamResumeInputPayload,
): Promise<{ path: string; state: TeamResumeInputState }> {
  const teamName = normalizeTeamName(payload.teamName);
  const state: TeamResumeInputState = {
    schemaVersion: RESUME_INPUT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    teamName,
    task: payload.task.trim(),
    backend: payload.backend,
    workers: payload.workers,
    subagents: payload.subagents,
    maxFixLoop: payload.maxFixLoop,
    watchdogMs: payload.watchdogMs,
    nonReportingMs: payload.nonReportingMs,
    cwd: canonicalizeWorkdir(payload.cwd),
  };

  if (!state.task) {
    throw new Error('Cannot persist resume input state without a non-empty task.');
  }

  const filePath = getTeamResumeInputPath(cwd, teamName);
  await ensureDirectory(path.dirname(filePath));
  await writeJsonFile(filePath, state);

  return {
    path: filePath,
    state,
  };
}

export async function readTeamResumeInputState(
  cwd: string,
  teamName: string,
): Promise<{ path: string; state: TeamResumeInputState } | null> {
  const filePath = getTeamResumeInputPath(cwd, teamName);
  const raw = await readJsonFile<unknown>(filePath);

  if (!raw) {
    return null;
  }

  if (!isRecord(raw)) {
    throw new Error(`Invalid resume input state at ${filePath}: expected JSON object.`);
  }

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== RESUME_INPUT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported resume input schema version at ${filePath}: expected ${RESUME_INPUT_SCHEMA_VERSION}.`,
    );
  }

  const rawTask = raw.task;
  if (typeof rawTask !== 'string' || !rawTask.trim()) {
    throw new Error(`Invalid persisted task in resume input state at ${filePath}.`);
  }

  const rawTeamName = raw.teamName;
  if (typeof rawTeamName !== 'string' || !rawTeamName.trim()) {
    throw new Error(`Invalid persisted teamName in resume input state at ${filePath}.`);
  }

  const rawSavedAt = raw.savedAt;
  if (typeof rawSavedAt !== 'string' || Number.isNaN(Date.parse(rawSavedAt))) {
    throw new Error(`Invalid persisted savedAt in resume input state at ${filePath}.`);
  }

  const rawCwd = raw.cwd;
  if (typeof rawCwd !== 'string' || !rawCwd.trim()) {
    throw new Error(`Invalid persisted cwd in resume input state at ${filePath}.`);
  }

  const parsedState: TeamResumeInputState = {
    schemaVersion: RESUME_INPUT_SCHEMA_VERSION,
    savedAt: new Date(rawSavedAt).toISOString(),
    teamName: normalizeTeamName(rawTeamName),
    task: rawTask.trim(),
    backend: normalizeBackend(raw.backend),
    workers: normalizePositiveInteger(raw.workers, 'workers'),
    subagents: normalizeSubagents(raw.subagents),
    maxFixLoop: normalizeNonNegativeInteger(raw.maxFixLoop, 'maxFixLoop'),
    watchdogMs:
      raw.watchdogMs === undefined
        ? undefined
        : normalizePositiveInteger(raw.watchdogMs, 'watchdogMs'),
    nonReportingMs:
      raw.nonReportingMs === undefined
        ? undefined
        : normalizePositiveInteger(raw.nonReportingMs, 'nonReportingMs'),
    cwd: canonicalizeWorkdir(rawCwd),
  };

  return {
    path: filePath,
    state: parsedState,
  };
}
