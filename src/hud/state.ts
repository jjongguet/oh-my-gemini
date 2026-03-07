import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeTeamNameCanonical } from '../common/team-name.js';
import {
  TeamStateStore,
  type PersistedTaskRecord,
  type PersistedWorkerDoneSignal,
  type PersistedWorkerHeartbeat,
  type PersistedWorkerStatus,
  type PersistedWorkerSnapshot,
} from '../state/index.js';
import {
  DEFAULT_HUD_CONFIG,
  type GeminiApiKeySource,
  type GeminiApiSnapshot,
  type HudConfig,
  type HudRenderContext,
  type HudPreset,
  type TeamHudSummary,
} from './types.js';

interface ReadHudContextInput {
  cwd: string;
  teamName?: string;
  env?: NodeJS.ProcessEnv;
}

const HUD_CONFIG_PATH = path.join('.gemini', 'hud-config.json');
const GEMINI_SETTINGS_PATH = path.join('.gemini', 'settings.json');
const GEMINI_USAGE_PATH = path.join('.gemini', 'usage.json');
const DEFAULT_TEAM_NAME = 'oh-my-gemini';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHudPreset(value: unknown): HudPreset | null {
  if (value === 'minimal' || value === 'focused' || value === 'full') {
    return value;
  }

  return null;
}

function readNumericField(source: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function clampPercent(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return Math.round(value);
}

function detectRateLimitedUsage(source: Record<string, unknown>): boolean {
  const status = source.status;
  if (status === 429) {
    return true;
  }

  const candidates = [source.error, source.message, source.reason];
  return candidates.some(
    (value) => typeof value === 'string' && /429|rate.?limit/i.test(value),
  );
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

function normalizeTeamName(value: string | undefined): string {
  const source = value?.trim() || DEFAULT_TEAM_NAME;
  return normalizeTeamNameCanonical(source);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function readVersion(): string | null {
  try {
    const filePath = fileURLToPath(import.meta.url);
    const packagePath = path.join(path.dirname(filePath), '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version : null;
  } catch {
    return null;
  }
}

function readGitBranch(cwd: string): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();

    const remote = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();

    const repoMatch = remote.match(/\/([^/]+?)(?:\.git)?$/);
    const repo = repoMatch?.[1];

    return repo ? `${repo}/${branch}` : branch;
  } catch {
    return null;
  }
}

function countTasksByStatus(tasks: PersistedTaskRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const task of tasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }

  return counts;
}

type WorkerRuntimeStatus = 'idle' | 'running' | 'blocked' | 'done' | 'failed' | 'unknown';

function normalizeSnapshotWorkerStatus(raw: string | undefined): WorkerRuntimeStatus {
  switch (raw) {
    case 'idle':
    case 'running':
    case 'blocked':
    case 'done':
    case 'failed':
      return raw;
    default:
      return 'unknown';
  }
}

function resolveWorkerRuntimeStatus(
  fallback: WorkerRuntimeStatus,
  heartbeat: PersistedWorkerHeartbeat | undefined,
  status: PersistedWorkerStatus | undefined,
  doneSignal: PersistedWorkerDoneSignal | undefined,
): WorkerRuntimeStatus {
  if (doneSignal) {
    return doneSignal.status === 'completed' ? 'done' : 'failed';
  }

  if (heartbeat?.alive === false) {
    return 'failed';
  }

  switch (status?.state) {
    case 'idle':
      return 'idle';
    case 'in_progress':
      return 'running';
    case 'blocked':
      return 'blocked';
    case 'failed':
      return 'failed';
    case 'unknown':
      return 'unknown';
    default:
      return fallback;
  }
}

function mergeWorkerCounts(input: {
  snapshotWorkers: PersistedWorkerSnapshot[];
  heartbeats: Record<string, PersistedWorkerHeartbeat>;
  statuses: Record<string, PersistedWorkerStatus>;
  doneSignals: Record<string, PersistedWorkerDoneSignal>;
}): TeamHudSummary['workers'] {
  const workerIds = new Set<string>();

  for (const worker of input.snapshotWorkers) {
    workerIds.add(worker.workerId);
  }

  for (const workerId of Object.keys(input.heartbeats)) {
    workerIds.add(workerId);
  }

  for (const workerId of Object.keys(input.statuses)) {
    workerIds.add(workerId);
  }

  for (const workerId of Object.keys(input.doneSignals)) {
    workerIds.add(workerId);
  }

  let running = 0;
  let done = 0;
  let failed = 0;

  for (const workerId of workerIds) {
    const snapshotWorker = input.snapshotWorkers.find((worker) => worker.workerId === workerId);
    const fallback = normalizeSnapshotWorkerStatus(snapshotWorker?.status);
    const resolved = resolveWorkerRuntimeStatus(
      fallback,
      input.heartbeats[workerId],
      input.statuses[workerId],
      input.doneSignals[workerId],
    );

    if (resolved === 'running' || resolved === 'blocked') {
      running += 1;
    }

    if (resolved === 'done') {
      done += 1;
    }

    if (resolved === 'failed') {
      failed += 1;
    }
  }

  const total = workerIds.size;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    running,
    done,
    failed,
    percent,
  };
}

async function readTeamSummary(cwd: string, requestedTeamName: string | undefined): Promise<TeamHudSummary> {
  const teamName = normalizeTeamName(requestedTeamName);
  const store = new TeamStateStore({ cwd });

  const [phase, snapshot, tasks, heartbeats, statuses, doneSignals] = await Promise.all([
    store.readPhaseState(teamName),
    store.readMonitorSnapshot(teamName),
    store.listTasks(teamName),
    store.readAllWorkerHeartbeats(teamName),
    store.readAllWorkerStatuses(teamName),
    store.readAllWorkerDoneSignals(teamName),
  ]);

  const taskCounts = countTasksByStatus(tasks);
  const taskTotal = tasks.length;
  const taskCompleted = taskCounts.completed ?? 0;
  const taskInProgress = (taskCounts.in_progress ?? 0) + (taskCounts.blocked ?? 0);

  const workers = mergeWorkerCounts({
    snapshotWorkers: snapshot?.workers ?? [],
    heartbeats,
    statuses,
    doneSignals,
  });

  const hasState =
    phase !== null ||
    snapshot !== null ||
    taskTotal > 0 ||
    workers.total > 0;

  const taskPercent = taskTotal === 0 ? 0 : Math.round((taskCompleted / taskTotal) * 100);

  return {
    teamName,
    hasState,
    phase: phase?.currentPhase ?? 'unknown',
    runtimeStatus: snapshot?.status ?? 'missing',
    updatedAt: snapshot?.updatedAt ?? phase?.updatedAt,
    tasks: {
      total: taskTotal,
      completed: taskCompleted,
      inProgress: taskInProgress,
      percent: taskPercent,
    },
    workers,
  };
}

function readGeminiModel(settings: Record<string, unknown>): string | null {
  const directModel = settings.model;
  if (typeof directModel === 'string' && directModel.trim()) {
    return directModel.trim();
  }

  const models = settings.models;
  if (isRecord(models)) {
    const defaultModel = models.default;
    if (typeof defaultModel === 'string' && defaultModel.trim()) {
      return defaultModel.trim();
    }
  }

  const chat = settings.chat;
  if (isRecord(chat)) {
    const chatModel = chat.model;
    if (typeof chatModel === 'string' && chatModel.trim()) {
      return chatModel.trim();
    }
  }

  return null;
}

async function detectGeminiApiKeySource(
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<GeminiApiKeySource> {
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    return 'env';
  }

  const oauthCandidates = [
    path.join(cwd, '.gemini', 'oauth.json'),
    path.join(os.homedir(), '.gemini', 'oauth.json'),
    path.join(os.homedir(), '.config', 'gemini', 'oauth.json'),
  ];

  for (const candidate of oauthCandidates) {
    try {
      await access(candidate);
      return 'oauth';
    } catch {
      // continue
    }
  }

  return 'unknown';
}

async function readGeminiApiSnapshot(
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<GeminiApiSnapshot> {
  const [settings, usage, keySource] = await Promise.all([
    readJsonFile<unknown>(path.join(cwd, GEMINI_SETTINGS_PATH)),
    readJsonFile<unknown>(path.join(cwd, GEMINI_USAGE_PATH)),
    detectGeminiApiKeySource(cwd, env),
  ]);

  const settingsRecord = isRecord(settings) ? settings : {};
  const usageRecord = isRecord(usage) ? usage : {};

  const model = readGeminiModel(settingsRecord);
  const windowPercent = clampPercent(readNumericField(usageRecord, [
    'windowPercent',
    'contextWindowPercent',
    'fiveHourPercent',
  ]));
  const quotaPercent = clampPercent(readNumericField(usageRecord, [
    'quotaPercent',
    'dailyPercent',
    'weeklyPercent',
  ]));
  const rateLimited = detectRateLimitedUsage(usageRecord);

  return {
    model,
    keySource,
    windowPercent,
    quotaPercent,
    rateLimited,
    updatedAt: normalizeIsoTimestamp(usageRecord.updatedAt),
  };
}

export async function readHudConfig(cwd: string): Promise<HudConfig> {
  const config = await readJsonFile<unknown>(path.join(cwd, HUD_CONFIG_PATH));
  if (!isRecord(config)) {
    return DEFAULT_HUD_CONFIG;
  }

  const preset = parseHudPreset(config.preset);
  if (!preset) {
    return DEFAULT_HUD_CONFIG;
  }

  return { preset };
}

export async function readHudContext(input: ReadHudContextInput): Promise<HudRenderContext> {
  const env = input.env ?? process.env;

  const [team, gemini] = await Promise.all([
    readTeamSummary(input.cwd, input.teamName),
    readGeminiApiSnapshot(input.cwd, env),
  ]);

  return {
    version: readVersion(),
    gitBranch: readGitBranch(input.cwd),
    team,
    gemini,
    generatedAt: new Date().toISOString(),
  };
}
