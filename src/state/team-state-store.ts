import { randomUUID } from 'node:crypto';
import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';

import {
  appendNdjsonFile,
  ensureDirectory,
  readJsonFile,
  readNdjsonFile,
  writeJsonFile,
} from './filesystem.js';
import type {
  PersistedLifecyclePhase,
  PersistedLifecyclePhaseValue,
  PersistedMailboxMessage,
  PersistedPhaseTransitionEvent,
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

export interface PersistedTaskWriteOptions {
  expectedVersion?: number;
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
  metadata?: Record<string, unknown>;
  message_id?: string;
  from_worker?: string;
  to_worker?: string;
  created_at?: string;
  delivered_at?: string;
  notified_at?: string;
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
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Task id cannot be empty.');
  }

  if (trimmed.startsWith('task-')) {
    const stripped = trimmed.slice('task-'.length).trim();
    if (!stripped) {
      throw new Error(`Invalid task id: ${raw}`);
    }
    return stripped;
  }

  return trimmed;
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

function coerceTaskRecord(raw: unknown, taskIdFallback?: string): PersistedTaskRecord | null {
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

function coerceMailboxMessage(
  raw: unknown,
  toWorkerFallback: string,
  indexFallback: number,
): PersistedMailboxMessage | null {
  if (!isRecord(raw)) {
    return null;
  }

  const now = new Date().toISOString();
  const fromWorker =
    typeof raw.fromWorker === 'string'
      ? raw.fromWorker
      : typeof raw.from_worker === 'string'
        ? raw.from_worker
        : '';
  const body = typeof raw.body === 'string' ? raw.body : '';

  if (!fromWorker || !body) {
    return null;
  }

  const deliveredAtRaw = raw.deliveredAt ?? raw.delivered_at;
  const notifiedAtRaw = raw.notifiedAt ?? raw.notified_at;

  return {
    messageId:
      typeof raw.messageId === 'string'
        ? raw.messageId
        : typeof raw.message_id === 'string'
          ? raw.message_id
          : `legacy-${toWorkerFallback}-${indexFallback}`,
    fromWorker,
    toWorker:
      typeof raw.toWorker === 'string'
        ? raw.toWorker
        : typeof raw.to_worker === 'string'
          ? raw.to_worker
          : toWorkerFallback,
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

async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath);
}

export class TeamStateStore {
  readonly rootDir: string;
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(options: TeamStateStoreOptions = {}) {
    const cwd = options.cwd ?? process.cwd();
    const configuredRoot =
      options.rootDir ?? process.env.OMG_STATE_ROOT ?? '.omg/state';

    this.rootDir = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(cwd, configuredRoot);
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
    return path.join(this.rootDir, 'team', teamName);
  }

  getPhaseFilePath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'phase.json');
  }

  getPhaseEventLogPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'events', 'phase-transitions.ndjson');
  }

  getMonitorSnapshotPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'monitor-snapshot.json');
  }

  getWorkerDir(teamName: string, workerName: string): string {
    return path.join(this.getTeamDir(teamName), 'workers', workerName);
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
    return path.join(this.getMailboxDir(teamName), `${workerName}.ndjson`);
  }

  getLegacyMailboxPath(teamName: string, workerName: string): string {
    return path.join(this.getMailboxDir(teamName), `${workerName}.json`);
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

    await writeJsonFile(this.getPhaseFilePath(teamName), canonicalState);
  }

  async appendPhaseTransition(
    teamName: string,
    transition: PersistedPhaseTransitionEvent,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await appendNdjsonFile(this.getPhaseEventLogPath(teamName), {
      ...transition,
      from: normalizeLifecyclePhase(transition.from),
      to: normalizeLifecyclePhase(transition.to),
    });
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
    await writeJsonFile(this.getMonitorSnapshotPath(teamName), snapshot);
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
    await writeJsonFile(
      this.getWorkerIdentityPath(identity.teamName, identity.workerName),
      identity,
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
    await writeJsonFile(
      this.getWorkerHeartbeatPath(heartbeat.teamName, heartbeat.workerName),
      heartbeat,
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
    await writeJsonFile(this.getWorkerStatusPath(teamName, workerName), status);
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
    await writeJsonFile(this.getWorkerDonePath(done.teamName, done.workerName), done);
  }

  async writeWorkerInbox(
    teamName: string,
    workerName: string,
    content: string,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await writeTextFileAtomic(
      this.getWorkerInboxPath(teamName, workerName),
      content.endsWith('\n') ? content : `${content}\n`,
    );
  }

  async readTask(
    teamName: string,
    taskId: string,
  ): Promise<PersistedTaskRecord | null> {
    const normalizedTaskId = normalizeTaskId(taskId);
    const canonical = await readJsonFile<unknown>(
      this.getTaskPath(teamName, normalizedTaskId),
    );

    if (canonical) {
      const normalized = coerceTaskRecord(canonical, normalizedTaskId);
      if (!normalized) {
        throw new Error(
          `Invalid task payload at ${this.getTaskPath(teamName, normalizedTaskId)}`,
        );
      }
      return normalized;
    }

    const legacy = await readJsonFile<unknown>(
      this.getLegacyTaskPath(teamName, normalizedTaskId),
    );

    if (!legacy) {
      return null;
    }

    const normalizedLegacy = coerceTaskRecord(legacy, normalizedTaskId);
    if (!normalizedLegacy) {
      throw new Error(
        `Invalid legacy task payload at ${this.getLegacyTaskPath(teamName, normalizedTaskId)}`,
      );
    }

    return normalizedLegacy;
  }

  async writeTask(
    teamName: string,
    task: PersistedTaskWriteInput,
    options: PersistedTaskWriteOptions = {},
  ): Promise<PersistedTaskRecord> {
    const normalizedTaskId = normalizeTaskId(task.id);

    return this.withSerializedWrite(`task:${teamName}:${normalizedTaskId}`, async () => {
      await this.ensureTeamScaffold(teamName);

      const existing = await this.readTask(teamName, normalizedTaskId);
      const existingVersion = existing?.version ?? 0;

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
        teamName,
        team_name: teamName,
        subject: task.subject || existing?.subject || `task-${normalizedTaskId}`,
        status: normalizeTaskStatus(task.status ?? existing?.status),
        version: nextVersion,
        createdAt: normalizeIsoTimestamp(task.createdAt ?? existing?.createdAt, now),
        updatedAt: now,
        created_at: normalizeIsoTimestamp(task.createdAt ?? existing?.createdAt, now),
        updated_at: now,
      };

      await writeJsonFile(this.getTaskPath(teamName, normalizedTaskId), persisted);
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

  async appendMailboxMessage(
    teamName: string,
    workerName: string,
    input: PersistedMailboxAppendInput,
  ): Promise<PersistedMailboxMessage> {
    const resolvedWorkerName = workerName.trim();
    if (!resolvedWorkerName) {
      throw new Error('Mailbox worker name cannot be empty.');
    }

    return this.withSerializedWrite(
      `mailbox:${teamName}:${resolvedWorkerName}`,
      async () => {
        await this.ensureTeamScaffold(teamName);

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
          messageId: messageId?.trim() || randomUUID(),
          fromWorker: normalizedFromWorker,
          toWorker: toWorker?.trim() || resolvedWorkerName,
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
          from_worker: normalizedFromWorker,
          to_worker: toWorker?.trim() || resolvedWorkerName,
          created_at: createdAt,
          delivered_at: input.deliveredAt ?? input.delivered_at,
          notified_at: input.notifiedAt ?? input.notified_at,
        };

        await appendNdjsonFile(
          this.getMailboxPath(teamName, resolvedWorkerName),
          message,
        );

        return message;
      },
    );
  }

  async readMailboxMessages(
    teamName: string,
    workerName: string,
  ): Promise<PersistedMailboxMessage[]> {
    const normalizedWorkerName = workerName.trim();
    if (!normalizedWorkerName) {
      return [];
    }

    const primary = await readNdjsonFile<PersistedMailboxMessage>(
      this.getMailboxPath(teamName, normalizedWorkerName),
    );

    if (primary.length > 0) {
      return primary;
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
}
