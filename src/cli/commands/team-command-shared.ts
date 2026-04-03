import path from 'node:path';

import { normalizeTeamNameCanonical } from '../../common/team-name.js';
import {
  ensureDirectory,
  readJsonFile,
  writeJsonFile,
} from '../../state/index.js';

import { canonicalizeWorkdir } from './workdir-security.js';

export type TeamBackend = 'tmux' | 'subagents' | 'gemini-spawn';

const TEAM_RUN_REQUEST_SCHEMA_VERSION = 1;
const TEAM_DEFAULT_NAME = 'oh-my-gemini';

export interface PersistedTeamRunRequest {
  schemaVersion: number;
  teamName: string;
  task: string;
  backend: TeamBackend;
  workers: number;
  subagents?: string[];
  maxFixLoop: number;
  watchdogMs?: number;
  nonReportingMs?: number;
  cwd: string;
  updatedAt: string;
}

export interface PersistTeamRunRequestInput {
  teamName: string;
  task: string;
  backend: TeamBackend;
  workers: number;
  subagents?: string[];
  maxFixLoop: number;
  watchdogMs?: number;
  nonReportingMs?: number;
  cwd: string;
}

export function assertValidTeamName(value: string): string {
  try {
    return normalizeTeamNameCanonical(value);
  } catch (error) {
    throw new Error(`Invalid --team value: ${(error as Error).message}`);
  }
}

export function normalizeTeamName(raw: string | undefined): string {
  const source = raw?.trim() || TEAM_DEFAULT_NAME;
  return assertValidTeamName(source);
}

export function isTeamBackend(value: string | undefined): value is TeamBackend {
  return value === 'tmux' || value === 'subagents' || value === 'gemini-spawn';
}

export function getTeamStateDir(cwd: string, teamName: string): string {
  return path.join(canonicalizeWorkdir(cwd), '.omg', 'state', 'team', normalizeTeamName(teamName));
}

export function getTeamRunRequestPath(cwd: string, teamName: string): string {
  return path.join(getTeamStateDir(cwd, teamName), 'run-request.json');
}

export async function persistTeamRunRequest(
  input: PersistTeamRunRequestInput,
): Promise<PersistedTeamRunRequest> {
  const teamName = normalizeTeamName(input.teamName);
  const updatedAt = new Date().toISOString();
  const persisted: PersistedTeamRunRequest = {
    schemaVersion: TEAM_RUN_REQUEST_SCHEMA_VERSION,
    teamName,
    task: input.task,
    backend: input.backend,
    workers: input.workers,
    subagents:
      input.subagents && input.subagents.length > 0
        ? [...input.subagents]
        : undefined,
    maxFixLoop: input.maxFixLoop,
    watchdogMs: input.watchdogMs,
    nonReportingMs: input.nonReportingMs,
    cwd: canonicalizeWorkdir(input.cwd),
    updatedAt,
  };

  const runRequestPath = getTeamRunRequestPath(input.cwd, teamName);
  await ensureDirectory(path.dirname(runRequestPath));
  await writeJsonFile(runRequestPath, persisted);
  return persisted;
}

export async function readTeamRunRequest(
  cwd: string,
  teamName: string,
): Promise<PersistedTeamRunRequest | null> {
  const raw = await readJsonFile<unknown>(getTeamRunRequestPath(cwd, teamName));
  if (!raw) {
    return null;
  }

  return coerceTeamRunRequest(raw, teamName);
}

function coerceTeamRunRequest(
  raw: unknown,
  teamNameFallback: string,
): PersistedTeamRunRequest | null {
  if (!isRecord(raw)) {
    return null;
  }

  const backend = typeof raw.backend === 'string' ? raw.backend : undefined;
  if (!isTeamBackend(backend)) {
    return null;
  }

  const task = typeof raw.task === 'string' ? raw.task.trim() : '';
  if (!task) {
    return null;
  }

  const workers = readInteger(raw.workers);
  if (!workers || workers <= 0) {
    return null;
  }

  const maxFixLoop = readInteger(raw.maxFixLoop);
  if (maxFixLoop === undefined || maxFixLoop < 0) {
    return null;
  }

  const watchdogMs = readOptionalPositiveInteger(raw.watchdogMs);
  const nonReportingMs = readOptionalPositiveInteger(raw.nonReportingMs);
  const subagents = normalizeStringArray(raw.subagents);
  const updatedAt = normalizeIsoTimestamp(raw.updatedAt);
  let teamName = TEAM_DEFAULT_NAME;
  try {
    teamName = normalizeTeamName(teamNameFallback);
  } catch {
    teamName = TEAM_DEFAULT_NAME;
  }

  if (typeof raw.teamName === 'string' && raw.teamName.trim()) {
    try {
      teamName = normalizeTeamName(raw.teamName);
    } catch {
      return null;
    }
  }

  const cwdSource =
    typeof raw.cwd === 'string' && raw.cwd.trim() ? raw.cwd : process.cwd();

  const cwd = canonicalizeWorkdir(cwdSource);

  return {
    schemaVersion: readInteger(raw.schemaVersion) ?? TEAM_RUN_REQUEST_SCHEMA_VERSION,
    teamName,
    task,
    backend,
    workers,
    subagents,
    maxFixLoop,
    watchdogMs,
    nonReportingMs,
    cwd,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

function readInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }
  return value;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = readInteger(value);
  if (parsed === undefined || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
