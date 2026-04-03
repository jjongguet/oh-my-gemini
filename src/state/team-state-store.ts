import { randomUUID } from 'node:crypto';
import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';

import {
  isTeamNameNormalizationError,
  normalizeTeamNameCanonical,
  type TeamNameNormalizationReason,
} from '../common/team-name.js';
import {
  appendNdjsonFile,
  ensureDirectory,
  readJsonFile,
  readNdjsonFile,
  writeJsonFile,
  writeNdjsonFile,
} from './filesystem.js';
import { atomicWriteFile } from '../lib/atomic-write.js';
import type {
  PersistedLifecyclePhase,
  PersistedLifecyclePhaseValue,
  PersistedMailboxMessage,
  PersistedPhaseTransitionEvent,
  PersistedTaskAuditAction,
  PersistedTaskAuditEvent,
  PersistedTaskRecord,
  PersistedTaskStatus,
  PersistedTeamPhaseState,
  PersistedTeamSnapshot,
  PersistedWorkerDoneSignal,
  PersistedWorkerHeartbeat,
  PersistedWorkerIdentity,
  PersistedWorkerStatus,
} from './types.js';

export interface TeamStateStoreOptions {
  rootDir?: string;
  cwd?: string;
}

export const CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE = 'control-plane' as const;

export interface PersistedTaskWriteOptions {
  expectedVersion?: number;
  lifecycleMutation?: typeof CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE;
}

export interface PersistedTaskWriteInput {
  id: string;
  subject: string;
  status: PersistedTaskStatus;
  description?: string;
  required?: boolean;
  owner?: string;
  teamName?: string;
  team_name?: string;
  dependsOn?: string[];
  depends_on?: string[];
  requiresCodeChange?: boolean;
  requires_code_change?: boolean;
  claim?: PersistedTaskRecord['claim'];
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface PersistedMailboxAppendInput {
  fromWorker: string;
  toWorker?: string;
  body: string;
  messageId?: string;
  createdAt?: string;
  deliveredAt?: string;
  notifiedAt?: string;
  pruneCompleted?: boolean;
  metadata?: Record<string, unknown>;
  message_id?: string;
  from_worker?: string;
  to_worker?: string;
  created_at?: string;
  delivered_at?: string;
  notified_at?: string;
}

export interface PersistedTaskAuditAppendInput {
  eventId?: string;
  taskId: string;
  action: PersistedTaskAuditAction;
  worker: string;
  at?: string;
  fromStatus?: PersistedTaskStatus;
  toStatus?: PersistedTaskStatus;
  claimTokenDigest?: string;
  leasedUntil?: string;
  reasonCode?: string;
  metadata?: Record<string, unknown>;
  event_id?: string;
  task_id?: string;
  from_status?: PersistedTaskStatus;
  to_status?: PersistedTaskStatus;
  claim_token_digest?: string;
  leased_until?: string;
  reason_code?: string;
}

type LegacyPersistedPhaseTransitionEvent = Omit<
  PersistedPhaseTransitionEvent,
  'from' | 'to'
> & {
  from: PersistedLifecyclePhaseValue;
  to: PersistedLifecyclePhaseValue;
};

type LegacyPersistedTeamPhaseState = Omit<
  PersistedTeamPhaseState,
  'currentPhase' | 'transitions'
> & {
  currentPhase: PersistedLifecyclePhaseValue;
  transitions: LegacyPersistedPhaseTransitionEvent[];
};

const STATE_FAILURE_CODES = {
  IDENTIFIER_EMPTY: 'OMG_STATE_IDENTIFIER_EMPTY',
  IDENTIFIER_TOO_LONG: 'OMG_STATE_IDENTIFIER_TOO_LONG',
  IDENTIFIER_PATH_TRAVERSAL: 'OMG_STATE_IDENTIFIER_PATH_TRAVERSAL',
  IDENTIFIER_INVALID: 'OMG_STATE_IDENTIFIER_INVALID',
} as const;

const MAX_IDENTIFIER_LENGTH = 128;
const PATH_SEPARATOR_PATTERN = /[\\/]/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

type StateFailureCode =
  (typeof STATE_FAILURE_CODES)[keyof typeof STATE_FAILURE_CODES];

type StateFailureError = Error & {
  code: StateFailureCode;
  reasonCode: StateFailureCode;
};

function createStateFailure(
  code: StateFailureCode,
  message: string,
): StateFailureError {
  const error = new Error(`[${code}] ${message}`) as StateFailureError;
  error.name = 'TeamStateStoreError';
  error.code = code;
  error.reasonCode = code;
  return error;
}

function normalizeIdentifier(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw createStateFailure(
      STATE_FAILURE_CODES.IDENTIFIER_EMPTY,
      `${label} cannot be empty.`,
    );
  }

  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw createStateFailure(
      STATE_FAILURE_CODES.IDENTIFIER_TOO_LONG,
      `${label} exceeds max length ${MAX_IDENTIFIER_LENGTH}.`,
    );
  }

  if (normalized === '.' || normalized === '..') {
    throw createStateFailure(
      STATE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL,
      `${label} cannot be "." or "..".`,
    );
  }

  if (PATH_SEPARATOR_PATTERN.test(normalized)) {
    throw createStateFailure(
      STATE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL,
      `${label} cannot contain path separators.`,
    );
  }

  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) {
    throw createStateFailure(
      STATE_FAILURE_CODES.IDENTIFIER_INVALID,
      `${label} must use only letters, numbers, ".", "_", or "-".`,
    );
  }

  return normalized;
}

function mapTeamNameReasonToStateFailureCode(
  reason: TeamNameNormalizationReason,
): StateFailureCode {
  switch (reason) {
    case 'empty':
      return STATE_FAILURE_CODES.IDENTIFIER_EMPTY;
    case 'too_long':
      return STATE_FAILURE_CODES.IDENTIFIER_TOO_LONG;
    case 'path_traversal':
      return STATE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL;
    case 'invalid':
      return STATE_FAILURE_CODES.IDENTIFIER_INVALID;
    default:
      return STATE_FAILURE_CODES.IDENTIFIER_INVALID;
  }
}

function normalizeTeamName(value: string): string {
  try {
    return normalizeTeamNameCanonical(value);
  } catch (error) {
    if (isTeamNameNormalizationError(error)) {
      throw createStateFailure(
        mapTeamNameReasonToStateFailureCode(error.reason),
        `teamName ${error.message}`,
      );
    }

    throw error;
  }
}

function normalizeWorkerName(value: string): string {
  return normalizeIdentifier('workerName', value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLifecyclePhase(
  raw: PersistedLifecyclePhaseValue | string,
): PersistedLifecyclePhase {
  if (raw === 'complete') {
    return 'completed';
  }

  switch (raw) {
    case 'plan':
    case 'exec':
    case 'verify':
    case 'fix':
    case 'completed':
    case 'failed':
      return raw;
    default:
      return 'failed';
  }
}

function normalizeTaskId(raw: string): string {
  const normalized = normalizeIdentifier('taskId', raw);
  const candidate = normalized.startsWith('task-')
    ? normalized.slice('task-'.length)
    : normalized;

  if (!candidate) {
    throw createStateFailure(
      STATE_FAILURE_CODES.IDENTIFIER_INVALID,
      `Invalid task id: ${raw}`,
    );
  }

  return normalizeIdentifier('taskId', candidate);
}

function isPersistedTaskStatus(value: unknown): value is PersistedTaskStatus {
  return (
    value === 'pending' ||
    value === 'in_progress' ||
    value === 'blocked' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'unknown' ||
    value === 'cancelled' ||
    value === 'canceled'
  );
}

function normalizeTaskStatus(value: unknown): PersistedTaskStatus {
  return isPersistedTaskStatus(value) ? value : 'pending';
}

function isPersistedTaskAuditAction(value: unknown): value is PersistedTaskAuditAction {
  return value === 'claim' || value === 'transition' || value === 'release';
}

function normalizeTaskAuditAction(value: unknown): PersistedTaskAuditAction | null {
  return isPersistedTaskAuditAction(value) ? value : null;
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requiresTaskLifecycleMutationScope(
  existing: PersistedTaskRecord | null,
  task: PersistedTaskWriteInput,
): boolean {
  const taskRecord = task as Record<string, unknown>;
  const resolvedStatus = normalizeTaskStatus(task.status ?? existing?.status);

  if (resolvedStatus !== 'pending') {
    return true;
  }

  if (existing?.status && existing.status !== 'pending') {
    return true;
  }

  if (hasOwn(taskRecord, 'claim') || hasOwn(taskRecord, 'result') || hasOwn(taskRecord, 'error')) {
    return true;
  }

  return false;
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

function normalizeIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function coerceTaskRecord(
  raw: unknown,
  taskIdFallback?: string,
  teamNameFallback?: string,
): PersistedTaskRecord | null {
  if (!isRecord(raw)) {
    return null;
  }

  const now = new Date().toISOString();
  const resolvedTaskId = normalizeTaskId(
    typeof raw.id === 'string' ? raw.id : taskIdFallback ?? '',
  );

  const status = isPersistedTaskStatus(raw.status)
    ? raw.status
    : 'pending';

  const versionRaw =
    typeof raw.version === 'number' && Number.isInteger(raw.version)
      ? raw.version
      : Number.NaN;
  const version = Number.isFinite(versionRaw) && versionRaw > 0 ? versionRaw : 1;
  let teamName = teamNameFallback;
  const teamNameRaw = raw.teamName ?? raw.team_name;
  if (typeof teamNameRaw === 'string' && teamNameRaw.trim()) {
    try {
      teamName = normalizeTeamName(teamNameRaw);
    } catch {
      teamName = teamNameFallback;
    }
  }

  const dependsOn = normalizeStringArray(raw.dependsOn ?? raw.depends_on);

  const claimRaw = raw.claim;
  const claim = isRecord(claimRaw)
    ? {
        owner: typeof claimRaw.owner === 'string' ? claimRaw.owner : '',
        token: typeof claimRaw.token === 'string' ? claimRaw.token : '',
        leasedUntil: normalizeIsoTimestamp(
          claimRaw.leasedUntil ?? claimRaw.leased_until,
          now,
        ),
      }
    : undefined;

  const normalizedClaim = claim && claim.owner && claim.token ? claim : undefined;

  return {
    id: resolvedTaskId,
    teamName,
    team_name: teamName,
    subject:
      typeof raw.subject === 'string' && raw.subject.trim()
        ? raw.subject
        : `task-${resolvedTaskId}`,
    description:
      typeof raw.description === 'string' ? raw.description : undefined,
    status,
    required:
      typeof raw.required === 'boolean' ? raw.required : undefined,
    owner: typeof raw.owner === 'string' ? raw.owner : undefined,
    dependsOn,
    depends_on: dependsOn,
    requiresCodeChange:
      typeof raw.requiresCodeChange === 'boolean'
        ? raw.requiresCodeChange
        : typeof raw.requires_code_change === 'boolean'
          ? raw.requires_code_change
          : undefined,
    claim: normalizedClaim,
    result: typeof raw.result === 'string' ? raw.result : undefined,
    error: typeof raw.error === 'string' ? raw.error : undefined,
    metadata: isRecord(raw.metadata) ? raw.metadata : undefined,
    version,
    createdAt: normalizeIsoTimestamp(raw.createdAt ?? raw.created_at, now),
    updatedAt: normalizeIsoTimestamp(raw.updatedAt ?? raw.updated_at, now),
    created_at: normalizeIsoTimestamp(raw.createdAt ?? raw.created_at, now),
    updated_at: normalizeIsoTimestamp(raw.updatedAt ?? raw.updated_at, now),
  };
}

function coerceTaskAuditEvent(
  raw: unknown,
  teamNameFallback: string,
): PersistedTaskAuditEvent | null {
  if (!isRecord(raw)) {
    return null;
  }

  const action = normalizeTaskAuditAction(raw.action);
  if (!action) {
    return null;
  }

  const eventIdRaw = raw.eventId ?? raw.event_id;
  const eventId =
    typeof eventIdRaw === 'string' && eventIdRaw.trim()
      ? eventIdRaw.trim()
      : '';
  if (!eventId) {
    return null;
  }

  const worker =
    typeof raw.worker === 'string' && raw.worker.trim() ? raw.worker.trim() : '';
  if (!worker) {
    return null;
  }

  let teamName = teamNameFallback;
  const teamNameRaw = raw.teamName ?? raw.team_name;
  if (typeof teamNameRaw === 'string' && teamNameRaw.trim()) {
    try {
      teamName = normalizeTeamName(teamNameRaw);
    } catch {
      return null;
    }
  }

  const taskIdRaw = raw.taskId ?? raw.task_id;
  if (typeof taskIdRaw !== 'string' || !taskIdRaw.trim()) {
    return null;
  }

  const taskId = normalizeTaskId(taskIdRaw);
  const now = new Date().toISOString();
  const fromStatusRaw = raw.fromStatus ?? raw.from_status;
  const fromStatus = isPersistedTaskStatus(fromStatusRaw)
    ? fromStatusRaw
    : undefined;
  const toStatusRaw = raw.toStatus ?? raw.to_status;
  const toStatus = isPersistedTaskStatus(toStatusRaw)
    ? toStatusRaw
    : undefined;
  const claimTokenDigestRaw = raw.claimTokenDigest ?? raw.claim_token_digest;
  const claimTokenDigest =
    typeof claimTokenDigestRaw === 'string' && claimTokenDigestRaw.trim()
      ? claimTokenDigestRaw.trim()
      : undefined;
  const reasonCodeRaw = raw.reasonCode ?? raw.reason_code;
  const reasonCode =
    typeof reasonCodeRaw === 'string' && reasonCodeRaw.trim()
      ? reasonCodeRaw.trim()
      : undefined;
  const leasedUntilRaw = raw.leasedUntil ?? raw.leased_until;
  const leasedUntil =
    typeof leasedUntilRaw === 'string' && leasedUntilRaw.trim()
      ? normalizeIsoTimestamp(leasedUntilRaw, now)
      : undefined;

  return {
    eventId,
    teamName,
    team_name: teamName,
    taskId,
    task_id: taskId,
    action,
    worker,
    at: normalizeIsoTimestamp(raw.at, now),
    fromStatus,
    from_status: fromStatus,
    toStatus,
    to_status: toStatus,
    claimTokenDigest,
    claim_token_digest: claimTokenDigest,
    leasedUntil,
    leased_until: leasedUntil,
    reasonCode,
    reason_code: reasonCode,
    metadata: isRecord(raw.metadata) ? raw.metadata : undefined,
    event_id:
      typeof raw.event_id === 'string'
        ? raw.event_id
        : typeof raw.eventId === 'string'
          ? raw.eventId
          : undefined,
  };
}

function coerceMailboxMessage(
  raw: unknown,
  toWorkerFallback: string,
  indexFallback: number,
): PersistedMailboxMessage | null {
  if (!isRecord(raw)) {
    return null;
  }

  const now = new Date().toISOString();
  const fromWorkerRaw =
    typeof raw.fromWorker === 'string'
      ? raw.fromWorker
      : typeof raw.from_worker === 'string'
        ? raw.from_worker
        : '';
  const body = typeof raw.body === 'string' ? raw.body : '';

  if (!fromWorkerRaw || !body) {
    return null;
  }

  const deliveredAtRaw = raw.deliveredAt ?? raw.delivered_at;
  const notifiedAtRaw = raw.notifiedAt ?? raw.notified_at;

  const fromWorker = normalizeWorkerName(fromWorkerRaw);
  const toWorkerRaw =
    typeof raw.toWorker === 'string'
      ? raw.toWorker
      : typeof raw.to_worker === 'string'
        ? raw.to_worker
        : toWorkerFallback;
  const toWorker = normalizeWorkerName(toWorkerRaw);

  return {
    messageId:
      typeof raw.messageId === 'string'
        ? normalizeIdentifier('messageId', raw.messageId)
        : typeof raw.message_id === 'string'
          ? normalizeIdentifier('messageId', raw.message_id)
          : `legacy-${toWorkerFallback}-${indexFallback}`,
    fromWorker,
    toWorker,
    body,
    createdAt: normalizeIsoTimestamp(raw.createdAt ?? raw.created_at, now),
    deliveredAt:
      typeof deliveredAtRaw === 'string'
        ? normalizeIsoTimestamp(deliveredAtRaw, now)
        : undefined,
    notifiedAt:
      typeof notifiedAtRaw === 'string'
        ? normalizeIsoTimestamp(notifiedAtRaw, now)
        : undefined,
    metadata: isRecord(raw.metadata) ? raw.metadata : undefined,
    message_id:
      typeof raw.message_id === 'string'
        ? raw.message_id
        : typeof raw.messageId === 'string'
          ? raw.messageId
          : undefined,
    from_worker:
      typeof raw.from_worker === 'string' ? raw.from_worker : undefined,
    to_worker:
      typeof raw.to_worker === 'string' ? raw.to_worker : undefined,
    created_at:
      typeof raw.created_at === 'string' ? raw.created_at : undefined,
    delivered_at:
      typeof raw.delivered_at === 'string' ? raw.delivered_at : undefined,
    notified_at:
      typeof raw.notified_at === 'string' ? raw.notified_at : undefined,
  };
}

function isMailboxMessageTerminal(message: PersistedMailboxMessage): boolean {
  return Boolean(message.deliveredAt && message.notifiedAt);
}

function mergeMailboxMessageTimelineEntries(
  previous: PersistedMailboxMessage,
  current: PersistedMailboxMessage,
): PersistedMailboxMessage {
  return {
    ...previous,
    ...current,
    messageId: previous.messageId,
    fromWorker: current.fromWorker || previous.fromWorker,
    toWorker: current.toWorker || previous.toWorker,
    body: current.body || previous.body,
    createdAt: previous.createdAt,
    deliveredAt: current.deliveredAt ?? previous.deliveredAt,
    notifiedAt: current.notifiedAt ?? previous.notifiedAt,
    metadata: current.metadata ?? previous.metadata,
    message_id: current.message_id ?? previous.message_id,
    from_worker: current.from_worker ?? previous.from_worker,
    to_worker: current.to_worker ?? previous.to_worker,
    created_at: current.created_at ?? previous.created_at,
    delivered_at: current.delivered_at ?? previous.delivered_at,
    notified_at: current.notified_at ?? previous.notified_at,
  };
}

function collapseMailboxTimelineEntries(
  timeline: PersistedMailboxMessage[],
): PersistedMailboxMessage[] {
  const collapsed = new Map<string, PersistedMailboxMessage>();

  for (const entry of timeline) {
    if (!entry.messageId) {
      continue;
    }

    const existing = collapsed.get(entry.messageId);
    if (!existing) {
      collapsed.set(entry.messageId, entry);
      continue;
    }

    collapsed.set(entry.messageId, mergeMailboxMessageTimelineEntries(existing, entry));
  }

  return [...collapsed.values()];
}

async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await atomicWriteFile(filePath, content);
}

export class TeamStateStore {
  readonly rootDir: string;
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(options: TeamStateStoreOptions = {}) {
    const cwd = options.cwd ?? process.cwd();
    const configuredRoot =
      options.rootDir ??
      process.env.OMG_TEAM_STATE_ROOT ??
      process.env.OMX_TEAM_STATE_ROOT ??
      process.env.OMG_STATE_ROOT ??
      '.omg/state';

    this.rootDir = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(cwd, configuredRoot);
  }

  private async withLockedWrite<T>(
    queueKey: string,
    _filePath: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withSerializedWrite(queueKey, operation);
  }

  private async withSerializedWrite<T>(
    queueKey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.writeQueues.get(queueKey) ?? Promise.resolve();

    let releaseCurrent: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    const chained = previous
      .catch(() => undefined)
      .then(() => current);
    this.writeQueues.set(queueKey, chained);

    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent?.();
      if (this.writeQueues.get(queueKey) === chained) {
        this.writeQueues.delete(queueKey);
      }
    }
  }

  getTeamDir(teamName: string): string {
    return path.join(this.rootDir, 'team', normalizeTeamName(teamName));
  }

  getPhaseFilePath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'phase.json');
  }

  getPhaseEventLogPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'events', 'phase-transitions.ndjson');
  }

  getTaskAuditLogPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'events', 'task-lifecycle.ndjson');
  }

  getMonitorSnapshotPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'monitor-snapshot.json');
  }

  getWorkerDir(teamName: string, workerName: string): string {
    return path.join(
      this.getTeamDir(teamName),
      'workers',
      normalizeWorkerName(workerName),
    );
  }

  getWorkerIdentityPath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'identity.json');
  }

  getWorkerHeartbeatPath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'heartbeat.json');
  }

  getWorkerStatusPath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'status.json');
  }

  getWorkerInboxPath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'inbox.md');
  }

  getWorkerDonePath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'done.json');
  }

  getTasksDir(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'tasks');
  }

  getTaskPath(teamName: string, taskId: string): string {
    return path.join(this.getTasksDir(teamName), `task-${normalizeTaskId(taskId)}.json`);
  }

  getLegacyTaskPath(teamName: string, taskId: string): string {
    return path.join(this.getTasksDir(teamName), `${normalizeTaskId(taskId)}.json`);
  }

  getMailboxDir(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'mailbox');
  }

  getMailboxPath(teamName: string, workerName: string): string {
    return path.join(
      this.getMailboxDir(teamName),
      `${normalizeWorkerName(workerName)}.ndjson`,
    );
  }

  getLegacyMailboxPath(teamName: string, workerName: string): string {
    return path.join(
      this.getMailboxDir(teamName),
      `${normalizeWorkerName(workerName)}.json`,
    );
  }

  async ensureTeamScaffold(teamName: string): Promise<void> {
    const teamDir = this.getTeamDir(teamName);
    await Promise.all([
      ensureDirectory(teamDir),
      ensureDirectory(path.join(teamDir, 'events')),
      ensureDirectory(path.join(teamDir, 'workers')),
      ensureDirectory(path.join(teamDir, 'tasks')),
      ensureDirectory(path.join(teamDir, 'mailbox')),
    ]);
  }

  async readPhaseState(teamName: string): Promise<PersistedTeamPhaseState | null> {
    const raw = await readJsonFile<LegacyPersistedTeamPhaseState>(
      this.getPhaseFilePath(teamName),
    );

    if (!raw) {
      return null;
    }

    return {
      ...raw,
      currentPhase: normalizeLifecyclePhase(raw.currentPhase),
      transitions: Array.isArray(raw.transitions)
        ? raw.transitions.map((transition) => ({
            ...transition,
            from: normalizeLifecyclePhase(transition.from),
            to: normalizeLifecyclePhase(transition.to),
          }))
        : [],
    };
  }

  async writePhaseState(
    teamName: string,
    state: PersistedTeamPhaseState,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);

    const canonicalState: PersistedTeamPhaseState = {
      ...state,
      currentPhase: normalizeLifecyclePhase(state.currentPhase),
      transitions: state.transitions.map((transition) => ({
        ...transition,
        from: normalizeLifecyclePhase(transition.from),
        to: normalizeLifecyclePhase(transition.to),
      })),
    };

    await this.withLockedWrite(
      `phase:${normalizeTeamName(teamName)}` ,
      this.getPhaseFilePath(teamName),
      () => writeJsonFile(this.getPhaseFilePath(teamName), canonicalState),
    );
  }

  async appendPhaseTransition(
    teamName: string,
    transition: PersistedPhaseTransitionEvent,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await this.withLockedWrite(
      `phase-events:${normalizeTeamName(teamName)}` ,
      this.getPhaseEventLogPath(teamName),
      () => appendNdjsonFile(this.getPhaseEventLogPath(teamName), {
        ...transition,
        from: normalizeLifecyclePhase(transition.from),
        to: normalizeLifecyclePhase(transition.to),
      }),
    );
  }

  async readMonitorSnapshot(
    teamName: string,
  ): Promise<PersistedTeamSnapshot | null> {
    return readJsonFile<PersistedTeamSnapshot>(this.getMonitorSnapshotPath(teamName));
  }

  async writeMonitorSnapshot(
    teamName: string,
    snapshot: PersistedTeamSnapshot,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await this.withLockedWrite(
      `monitor:${normalizeTeamName(teamName)}` ,
      this.getMonitorSnapshotPath(teamName),
      () => writeJsonFile(this.getMonitorSnapshotPath(teamName), snapshot),
    );
  }

  async readWorkerIdentity(
    teamName: string,
    workerName: string,
  ): Promise<PersistedWorkerIdentity | null> {
    return readJsonFile<PersistedWorkerIdentity>(
      this.getWorkerIdentityPath(teamName, workerName),
    );
  }

  async writeWorkerIdentity(identity: PersistedWorkerIdentity): Promise<void> {
    await this.ensureTeamScaffold(identity.teamName);
    await this.withLockedWrite(
      `worker-identity:${normalizeTeamName(identity.teamName)}:${normalizeWorkerName(identity.workerName)}` ,
      this.getWorkerIdentityPath(identity.teamName, identity.workerName),
      () => writeJsonFile(
        this.getWorkerIdentityPath(identity.teamName, identity.workerName),
        identity,
      ),
    );
  }

  async readWorkerHeartbeat(
    teamName: string,
    workerName: string,
  ): Promise<PersistedWorkerHeartbeat | null> {
    return readJsonFile<PersistedWorkerHeartbeat>(
      this.getWorkerHeartbeatPath(teamName, workerName),
    );
  }

  async writeWorkerHeartbeat(
    heartbeat: PersistedWorkerHeartbeat,
  ): Promise<void> {
    await this.ensureTeamScaffold(heartbeat.teamName);
    await this.withLockedWrite(
      `worker-heartbeat:${normalizeTeamName(heartbeat.teamName)}:${normalizeWorkerName(heartbeat.workerName)}` ,
      this.getWorkerHeartbeatPath(heartbeat.teamName, heartbeat.workerName),
      () => writeJsonFile(
        this.getWorkerHeartbeatPath(heartbeat.teamName, heartbeat.workerName),
        heartbeat,
      ),
    );
  }

  async readWorkerStatus(
    teamName: string,
    workerName: string,
  ): Promise<PersistedWorkerStatus | null> {
    return readJsonFile<PersistedWorkerStatus>(
      this.getWorkerStatusPath(teamName, workerName),
    );
  }

  async writeWorkerStatus(
    teamName: string,
    workerName: string,
    status: PersistedWorkerStatus,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await this.withLockedWrite(
      `worker-status:${normalizeTeamName(teamName)}:${normalizeWorkerName(workerName)}` ,
      this.getWorkerStatusPath(teamName, workerName),
      () => writeJsonFile(this.getWorkerStatusPath(teamName, workerName), status),
    );
  }

  async readWorkerDone(
    teamName: string,
    workerName: string,
  ): Promise<PersistedWorkerDoneSignal | null> {
    return readJsonFile<PersistedWorkerDoneSignal>(
      this.getWorkerDonePath(teamName, workerName),
    );
  }

  async writeWorkerDone(done: PersistedWorkerDoneSignal): Promise<void> {
    await this.ensureTeamScaffold(done.teamName);
    await this.withLockedWrite(
      `worker-done:${normalizeTeamName(done.teamName)}:${normalizeWorkerName(done.workerName)}` ,
      this.getWorkerDonePath(done.teamName, done.workerName),
      () => writeJsonFile(this.getWorkerDonePath(done.teamName, done.workerName), done),
    );
  }

  async writeWorkerInbox(
    teamName: string,
    workerName: string,
    content: string,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await this.withLockedWrite(
      `worker-inbox:${normalizeTeamName(teamName)}:${normalizeWorkerName(workerName)}` ,
      this.getWorkerInboxPath(teamName, workerName),
      () => writeTextFileAtomic(
        this.getWorkerInboxPath(teamName, workerName),
        content.endsWith('\n') ? content : `${content}\n`,
      ),
    );
  }

  async readTask(
    teamName: string,
    taskId: string,
  ): Promise<PersistedTaskRecord | null> {
    const normalizedTeamName = normalizeTeamName(teamName);
    const normalizedTaskId = normalizeTaskId(taskId);
    const canonical = await readJsonFile<unknown>(
      this.getTaskPath(normalizedTeamName, normalizedTaskId),
    );

    if (canonical) {
      const normalized = coerceTaskRecord(
        canonical,
        normalizedTaskId,
        normalizedTeamName,
      );
      if (!normalized) {
        throw new Error(
          `Invalid task payload at ${this.getTaskPath(normalizedTeamName, normalizedTaskId)}`,
        );
      }
      return normalized;
    }

    const legacy = await readJsonFile<unknown>(
      this.getLegacyTaskPath(normalizedTeamName, normalizedTaskId),
    );

    if (!legacy) {
      return null;
    }

    const normalizedLegacy = coerceTaskRecord(
      legacy,
      normalizedTaskId,
      normalizedTeamName,
    );
    if (!normalizedLegacy) {
      throw new Error(
        `Invalid legacy task payload at ${this.getLegacyTaskPath(normalizedTeamName, normalizedTaskId)}`,
      );
    }

    return normalizedLegacy;
  }

  async writeTask(
    teamName: string,
    task: PersistedTaskWriteInput,
    options: PersistedTaskWriteOptions = {},
  ): Promise<PersistedTaskRecord> {
    const normalizedTeamName = normalizeTeamName(teamName);
    const normalizedTaskId = normalizeTaskId(task.id);

    return this.withSerializedWrite(`task:${normalizedTeamName}:${normalizedTaskId}`, async () => {
      await this.ensureTeamScaffold(normalizedTeamName);

      const existing = await this.readTask(normalizedTeamName, normalizedTaskId);
      const existingVersion = existing?.version ?? 0;

      if (
        requiresTaskLifecycleMutationScope(existing, task) &&
        options.lifecycleMutation !== CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE
      ) {
        throw new Error(
          `Task lifecycle mutation for task-${normalizedTaskId} requires TeamControlPlane claim/transition/release APIs.`,
        );
      }

      if (
        options.expectedVersion !== undefined &&
        options.expectedVersion !== existingVersion
      ) {
        throw new Error(
          `Version mismatch (CAS mismatch) for task-${normalizedTaskId}: expected ${options.expectedVersion}, actual ${existingVersion}.`,
        );
      }

      const nextVersion = task.version ?? existingVersion + 1;
      if (!Number.isInteger(nextVersion) || nextVersion <= existingVersion) {
        throw new Error(
          `Task version must increase monotonically for ${normalizedTaskId}. Existing=${existingVersion}, next=${nextVersion}.`,
        );
      }

      const now = new Date().toISOString();
      const persisted: PersistedTaskRecord = {
        ...existing,
        ...task,
        id: normalizedTaskId,
        teamName: normalizedTeamName,
        team_name: normalizedTeamName,
        subject: task.subject || existing?.subject || `task-${normalizedTaskId}`,
        status: normalizeTaskStatus(task.status ?? existing?.status),
        version: nextVersion,
        createdAt: normalizeIsoTimestamp(task.createdAt ?? existing?.createdAt, now),
        updatedAt: now,
        created_at: normalizeIsoTimestamp(task.createdAt ?? existing?.createdAt, now),
        updated_at: now,
      };

      await this.withLockedWrite(
        `task-file:${normalizedTeamName}:${normalizedTaskId}` ,
        this.getTaskPath(normalizedTeamName, normalizedTaskId),
        () => writeJsonFile(this.getTaskPath(normalizedTeamName, normalizedTaskId), persisted),
      );
      return persisted;
    });
  }

  async listTasks(teamName: string): Promise<PersistedTaskRecord[]> {
    const tasksDir = this.getTasksDir(teamName);

    let entries: Dirent[];
    try {
      entries = await fs.readdir(tasksDir, { withFileTypes: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }

      throw new Error(
        `Failed to list tasks for team "${teamName}": ${(error as Error).message}`,
      );
    }

    const ids = new Set<string>();

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const canonicalMatch = entry.name.match(/^task-(.+)\.json$/);
      if (canonicalMatch?.[1]) {
        ids.add(normalizeTaskId(canonicalMatch[1]));
        continue;
      }

      const legacyMatch = entry.name.match(/^(.+)\.json$/);
      if (legacyMatch?.[1]) {
        ids.add(normalizeTaskId(legacyMatch[1]));
      }
    }

    const sortedIds = [...ids].sort((left, right) => {
      const leftNum = Number.parseInt(left, 10);
      const rightNum = Number.parseInt(right, 10);

      const leftNumeric = Number.isFinite(leftNum);
      const rightNumeric = Number.isFinite(rightNum);

      if (leftNumeric && rightNumeric) {
        return leftNum - rightNum;
      }

      return left.localeCompare(right);
    });

    const tasks = await Promise.all(
      sortedIds.map((taskId) => this.readTask(teamName, taskId)),
    );

    return tasks.filter((task): task is PersistedTaskRecord => task !== null);
  }

  async appendTaskAuditEvent(
    teamName: string,
    input: PersistedTaskAuditAppendInput,
  ): Promise<PersistedTaskAuditEvent> {
    const normalizedTeamName = normalizeTeamName(teamName);

    return this.withSerializedWrite(`task-audit:${normalizedTeamName}`, async () => {
      await this.ensureTeamScaffold(normalizedTeamName);

      const action = normalizeTaskAuditAction(input.action);
      if (!action) {
        throw new Error(`Invalid task audit action: ${String(input.action)}.`);
      }

      const taskId = normalizeTaskId(input.taskId ?? input.task_id ?? '');
      const worker = normalizeWorkerName(input.worker);

      const at = normalizeIsoTimestamp(input.at, new Date().toISOString());
      const fromStatusRaw = input.fromStatus ?? input.from_status;
      const toStatusRaw = input.toStatus ?? input.to_status;

      if (fromStatusRaw !== undefined && !isPersistedTaskStatus(fromStatusRaw)) {
        throw new Error(`Invalid fromStatus for task audit event: ${String(fromStatusRaw)}.`);
      }

      if (toStatusRaw !== undefined && !isPersistedTaskStatus(toStatusRaw)) {
        throw new Error(`Invalid toStatus for task audit event: ${String(toStatusRaw)}.`);
      }

      const fromStatus = isPersistedTaskStatus(fromStatusRaw) ? fromStatusRaw : undefined;
      const toStatus = isPersistedTaskStatus(toStatusRaw) ? toStatusRaw : undefined;

      const claimTokenDigestRaw = input.claimTokenDigest ?? input.claim_token_digest;
      const claimTokenDigest =
        typeof claimTokenDigestRaw === 'string' && claimTokenDigestRaw.trim()
          ? claimTokenDigestRaw.trim()
          : undefined;
      const reasonCodeRaw = input.reasonCode ?? input.reason_code;
      const reasonCode =
        typeof reasonCodeRaw === 'string' && reasonCodeRaw.trim()
          ? normalizeIdentifier('reasonCode', reasonCodeRaw)
          : undefined;

      const leasedUntilRaw = input.leasedUntil ?? input.leased_until;
      const leasedUntil =
        typeof leasedUntilRaw === 'string' && leasedUntilRaw.trim()
          ? normalizeIsoTimestamp(leasedUntilRaw, at)
          : undefined;

      const eventIdRaw = input.eventId ?? input.event_id;
      const eventId =
        typeof eventIdRaw === 'string' && eventIdRaw.trim()
          ? normalizeIdentifier('eventId', eventIdRaw)
          : randomUUID();

      const event: PersistedTaskAuditEvent = {
        eventId,
        teamName: normalizedTeamName,
        team_name: normalizedTeamName,
        taskId,
        task_id: taskId,
        action,
        worker,
        at,
        fromStatus,
        from_status: fromStatus,
        toStatus,
        to_status: toStatus,
        claimTokenDigest,
        claim_token_digest: claimTokenDigest,
        leasedUntil,
        leased_until: leasedUntil,
        reasonCode,
        reason_code: reasonCode,
        metadata: input.metadata,
        event_id: eventId,
      };

      await this.withLockedWrite(
        `task-audit-file:${normalizedTeamName}` ,
        this.getTaskAuditLogPath(normalizedTeamName),
        () => appendNdjsonFile(this.getTaskAuditLogPath(normalizedTeamName), event),
      );
      return event;
    });
  }

  async readTaskAuditEvents(teamName: string): Promise<PersistedTaskAuditEvent[]> {
    const normalizedTeamName = normalizeTeamName(teamName);
    const timeline = await readNdjsonFile<unknown>(this.getTaskAuditLogPath(normalizedTeamName));
    return timeline
      .map((entry) => coerceTaskAuditEvent(entry, normalizedTeamName))
      .filter((entry): entry is PersistedTaskAuditEvent => entry !== null);
  }

  async listTaskAuditEvents(teamName: string): Promise<PersistedTaskAuditEvent[]> {
    return this.readTaskAuditEvents(teamName);
  }

  private async readMailboxMessagesInternal(
    teamName: string,
    workerName: string,
  ): Promise<PersistedMailboxMessage[]> {
    const normalizedWorkerName = normalizeWorkerName(workerName);
    const mailboxPath = this.getMailboxPath(teamName, normalizedWorkerName);

    const primary = await readNdjsonFile<PersistedMailboxMessage>(mailboxPath);

    try {
      await fs.access(mailboxPath);
      return primary;
    } catch {
      // Fall back to legacy JSON only when the primary NDJSON mailbox does not exist.
    }

    const legacyRaw = await readJsonFile<unknown>(
      this.getLegacyMailboxPath(teamName, normalizedWorkerName),
    );

    if (!legacyRaw) {
      return [];
    }

    const entries = Array.isArray(legacyRaw)
      ? legacyRaw
      : isRecord(legacyRaw) && Array.isArray(legacyRaw.messages)
        ? legacyRaw.messages
        : [];

    return entries
      .map((entry, index) => coerceMailboxMessage(entry, normalizedWorkerName, index + 1))
      .filter((entry): entry is PersistedMailboxMessage => entry !== null);
  }

  async updateMailboxMessages<TResult>(
    teamName: string,
    workerName: string,
    updater: (messages: PersistedMailboxMessage[]) => Promise<{
      messages: PersistedMailboxMessage[];
      result: TResult;
    }> | {
      messages: PersistedMailboxMessage[];
      result: TResult;
    },
  ): Promise<TResult> {
    const normalizedTeamName = normalizeTeamName(teamName);
    const resolvedWorkerName = normalizeWorkerName(workerName);
    const mailboxPath = this.getMailboxPath(normalizedTeamName, resolvedWorkerName);

    await this.ensureTeamScaffold(normalizedTeamName);

    return this.withLockedWrite(
      `mailbox-file:${normalizedTeamName}:${resolvedWorkerName}` ,
      mailboxPath,
      async () => {
        const current = collapseMailboxTimelineEntries(
          await this.readMailboxMessagesInternal(normalizedTeamName, resolvedWorkerName),
        );
        const next = await updater(current);
        const deduped = collapseMailboxTimelineEntries(next.messages).filter(
          (message) => !isMailboxMessageTerminal(message),
        );

        await writeNdjsonFile(mailboxPath, deduped);
        await fs.rm(
          this.getLegacyMailboxPath(normalizedTeamName, resolvedWorkerName),
          { force: true },
        ).catch(() => undefined);

        return next.result;
      },
    );
  }

  async appendMailboxMessage(
    teamName: string,
    workerName: string,
    input: PersistedMailboxAppendInput,
  ): Promise<PersistedMailboxMessage> {
    const normalizedTeamName = normalizeTeamName(teamName);
    const resolvedWorkerName = normalizeWorkerName(workerName);
    const createdAt = normalizeIsoTimestamp(
      input.createdAt ?? input.created_at,
      new Date().toISOString(),
    );
    const messageId = input.messageId ?? input.message_id;
    const fromWorker = input.fromWorker ?? input.from_worker;
    const toWorker = input.toWorker ?? input.to_worker;
    if (!fromWorker || !fromWorker.trim()) {
      throw new Error('Mailbox message requires fromWorker/from_worker.');
    }
    const normalizedFromWorker = fromWorker.trim();

    const message: PersistedMailboxMessage = {
      messageId: messageId?.trim()
        ? normalizeIdentifier('messageId', messageId)
        : randomUUID(),
      fromWorker: normalizeWorkerName(normalizedFromWorker),
      toWorker: toWorker?.trim() ? normalizeWorkerName(toWorker) : resolvedWorkerName,
      body: input.body,
      createdAt,
      deliveredAt: input.deliveredAt
        ? normalizeIsoTimestamp(input.deliveredAt, createdAt)
        : input.delivered_at
          ? normalizeIsoTimestamp(input.delivered_at, createdAt)
          : undefined,
      notifiedAt: input.notifiedAt
        ? normalizeIsoTimestamp(input.notifiedAt, createdAt)
        : input.notified_at
          ? normalizeIsoTimestamp(input.notified_at, createdAt)
          : undefined,
      metadata: input.metadata,
      message_id: messageId?.trim() || undefined,
      from_worker: normalizeWorkerName(normalizedFromWorker),
      to_worker: toWorker?.trim() ? normalizeWorkerName(toWorker) : resolvedWorkerName,
      created_at: createdAt,
      delivered_at: input.deliveredAt ?? input.delivered_at,
      notified_at: input.notifiedAt ?? input.notified_at,
    };

    return this.updateMailboxMessages(
      normalizedTeamName,
      resolvedWorkerName,
      (messages) => {
        const existing = messages.find((entry) => entry.messageId === message.messageId);
        const nextMessage = existing
          ? mergeMailboxMessageTimelineEntries(existing, message)
          : message;
        const nextMessages = existing
          ? messages.map((entry) =>
              entry.messageId === nextMessage.messageId ? nextMessage : entry,
            )
          : [...messages, nextMessage];

        return {
          messages: nextMessages,
          result: nextMessage,
        };
      },
    );
  }

  async overwriteMailboxMessages(
    teamName: string,
    workerName: string,
    messages: PersistedMailboxMessage[],
  ): Promise<void> {
    const normalizedTeamName = normalizeTeamName(teamName);
    const normalizedWorkerName = normalizeWorkerName(workerName);

    await this.ensureTeamScaffold(normalizedTeamName);
    await this.withLockedWrite(
      `mailbox-file:${normalizedTeamName}:${normalizedWorkerName}` ,
      this.getMailboxPath(normalizedTeamName, normalizedWorkerName),
      async () => {
        const mailboxPath = this.getMailboxPath(normalizedTeamName, normalizedWorkerName);
        if (messages.length === 0) {
          await fs.rm(mailboxPath, { force: true });
          return;
        }

        await writeNdjsonFile(mailboxPath, messages);
      },
    );
  }

  async readMailboxMessages(
    teamName: string,
    workerName: string,
  ): Promise<PersistedMailboxMessage[]> {
    return this.readMailboxMessagesInternal(teamName, workerName);
  }

  async listMailboxMessages(
    teamName: string,
    workerName: string,
  ): Promise<PersistedMailboxMessage[]> {
    return this.readMailboxMessages(teamName, workerName);
  }

  async listMailboxWorkers(teamName: string): Promise<string[]> {
    const mailboxDir = this.getMailboxDir(teamName);

    try {
      const entries = await fs.readdir(mailboxDir, { withFileTypes: true });

      const workers = entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          if (entry.name.endsWith('.ndjson')) {
            return entry.name.slice(0, -'.ndjson'.length);
          }

          if (entry.name.endsWith('.json')) {
            return entry.name.slice(0, -'.json'.length);
          }

          return '';
        })
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      return [...new Set(workers)];
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }

      throw new Error(
        `Failed to list mailbox workers for team "${teamName}": ${(error as Error).message}`,
      );
    }
  }

  async listWorkers(teamName: string): Promise<string[]> {
    const workersDir = path.join(this.getTeamDir(teamName), 'workers');

    try {
      const entries = await fs.readdir(workersDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }

      throw new Error(
        `Failed to list workers for team "${teamName}": ${(error as Error).message}`,
      );
    }
  }

  async readAllWorkerHeartbeats(
    teamName: string,
  ): Promise<Record<string, PersistedWorkerHeartbeat>> {
    const workers = await this.listWorkers(teamName);
    const heartbeats = await Promise.all(
      workers.map(async (workerName) => {
        const heartbeat = await this.readWorkerHeartbeat(teamName, workerName);
        return heartbeat ? [workerName, heartbeat] : null;
      }),
    );

    return Object.fromEntries(
      heartbeats.filter(
        (entry): entry is [string, PersistedWorkerHeartbeat] => entry !== null,
      ),
    );
  }

  async readAllWorkerIdentities(
    teamName: string,
  ): Promise<Record<string, PersistedWorkerIdentity>> {
    const workers = await this.listWorkers(teamName);
    const identities = await Promise.all(
      workers.map(async (workerName) => {
        const identity = await this.readWorkerIdentity(teamName, workerName);
        return identity ? [workerName, identity] : null;
      }),
    );

    return Object.fromEntries(
      identities.filter(
        (entry): entry is [string, PersistedWorkerIdentity] => entry !== null,
      ),
    );
  }

  async readAllWorkerStatuses(
    teamName: string,
  ): Promise<Record<string, PersistedWorkerStatus>> {
    const workers = await this.listWorkers(teamName);
    const statuses = await Promise.all(
      workers.map(async (workerName) => {
        const status = await this.readWorkerStatus(teamName, workerName);
        return status ? [workerName, status] : null;
      }),
    );

    return Object.fromEntries(
      statuses.filter(
        (entry): entry is [string, PersistedWorkerStatus] => entry !== null,
      ),
    );
  }

  async readAllWorkerDoneSignals(
    teamName: string,
  ): Promise<Record<string, PersistedWorkerDoneSignal>> {
    const workers = await this.listWorkers(teamName);
    const doneSignals = await Promise.all(
      workers.map(async (workerName) => {
        const doneSignal = await this.readWorkerDone(teamName, workerName);
        return doneSignal ? [workerName, doneSignal] : null;
      }),
    );

    return Object.fromEntries(
      doneSignals.filter(
        (entry): entry is [string, PersistedWorkerDoneSignal] => entry !== null,
      ),
    );
  }
}
