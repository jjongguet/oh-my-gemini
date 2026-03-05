import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  TeamStateStore,
  type PersistedMailboxMessage,
  type PersistedTaskRecord,
} from '../state/index.js';
import { TeamControlPlane } from '../team/control-plane/index.js';

export type InteropSystem = 'omc' | 'omg';

export type InteropMode = 'off' | 'observe' | 'active';

export interface InteropConfig {
  sessionId: string;
  createdAt: string;
  omgCwd: string;
  omcCwd?: string;
  status: 'active' | 'completed' | 'failed';
}

export interface SharedInteropTask {
  id: string;
  source: InteropSystem;
  target: InteropSystem;
  type: 'analyze' | 'implement' | 'review' | 'test' | 'custom';
  description: string;
  context?: Record<string, unknown>;
  files?: string[];
  createdAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  error?: string;
  completedAt?: string;
}

export interface SharedInteropMessage {
  id: string;
  source: InteropSystem;
  target: InteropSystem;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}

export interface ReadSharedTasksFilter {
  source?: InteropSystem;
  target?: InteropSystem;
  status?: SharedInteropTask['status'];
}

export interface ReadSharedMessagesFilter {
  source?: InteropSystem;
  target?: InteropSystem;
  unreadOnly?: boolean;
}

export function getInteropMode(env: NodeJS.ProcessEnv = process.env): InteropMode {
  const raw = (
    env.OMG_OMC_INTEROP_MODE ??
    env.OMX_OMC_INTEROP_MODE ??
    'off'
  ).toLowerCase();

  if (raw === 'observe' || raw === 'active') {
    return raw;
  }

  return 'off';
}

export function canUseOmgDirectWriteBridge(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const interopEnabled =
    env.OMG_OMC_INTEROP_ENABLED === '1' ||
    env.OMX_OMC_INTEROP_ENABLED === '1';

  const toolsEnabled =
    env.OMG_INTEROP_TOOLS_ENABLED === '1' ||
    env.OMC_INTEROP_TOOLS_ENABLED === '1';

  return interopEnabled && toolsEnabled && getInteropMode(env) === 'active';
}

function writeJsonFileAtomicSync(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;

  writeFileSync(tempPath, payload, 'utf8');
  renameSync(tempPath, filePath);
}

function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function ensureInteropScaffold(cwd: string): void {
  const interopDir = getInteropDir(cwd);
  mkdirSync(path.join(interopDir, 'tasks'), { recursive: true });
  mkdirSync(path.join(interopDir, 'messages'), { recursive: true });
}

export function getInteropDir(cwd: string): string {
  return path.join(cwd, '.omg', 'state', 'interop');
}

export function initInteropSession(
  sessionId: string,
  omgCwd: string,
  omcCwd?: string,
): InteropConfig {
  ensureInteropScaffold(omgCwd);

  const config: InteropConfig = {
    sessionId,
    createdAt: new Date().toISOString(),
    omgCwd,
    omcCwd,
    status: 'active',
  };

  writeJsonFileAtomicSync(path.join(getInteropDir(omgCwd), 'config.json'), config);
  return config;
}

export function readInteropConfig(cwd: string): InteropConfig | null {
  return readJsonFileSafe<InteropConfig>(path.join(getInteropDir(cwd), 'config.json'));
}

export function addSharedTask(
  cwd: string,
  task: Omit<SharedInteropTask, 'id' | 'createdAt' | 'status'>,
): SharedInteropTask {
  ensureInteropScaffold(cwd);

  const next: SharedInteropTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  const taskPath = path.join(getInteropDir(cwd), 'tasks', `${next.id}.json`);
  writeJsonFileAtomicSync(taskPath, next);
  return next;
}

export function readSharedTasks(
  cwd: string,
  filter: ReadSharedTasksFilter = {},
): SharedInteropTask[] {
  const tasksDir = path.join(getInteropDir(cwd), 'tasks');
  if (!existsSync(tasksDir)) {
    return [];
  }

  const tasks: SharedInteropTask[] = [];
  for (const entry of readdirSync(tasksDir)) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    const task = readJsonFileSafe<SharedInteropTask>(path.join(tasksDir, entry));
    if (!task) {
      continue;
    }

    if (filter.source && task.source !== filter.source) {
      continue;
    }

    if (filter.target && task.target !== filter.target) {
      continue;
    }

    if (filter.status && task.status !== filter.status) {
      continue;
    }

    tasks.push(task);
  }

  return tasks.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function updateSharedTask(
  cwd: string,
  taskId: string,
  updates: Partial<Omit<SharedInteropTask, 'id' | 'createdAt'>>,
): SharedInteropTask | null {
  const taskPath = path.join(getInteropDir(cwd), 'tasks', `${taskId}.json`);
  const current = readJsonFileSafe<SharedInteropTask>(taskPath);
  if (!current) {
    return null;
  }

  const merged: SharedInteropTask = {
    ...current,
    ...updates,
  };

  if (
    !merged.completedAt &&
    (merged.status === 'completed' || merged.status === 'failed')
  ) {
    merged.completedAt = new Date().toISOString();
  }

  writeJsonFileAtomicSync(taskPath, merged);
  return merged;
}

export function addSharedMessage(
  cwd: string,
  message: Omit<SharedInteropMessage, 'id' | 'timestamp' | 'read'>,
): SharedInteropMessage {
  ensureInteropScaffold(cwd);

  const next: SharedInteropMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const messagePath = path.join(getInteropDir(cwd), 'messages', `${next.id}.json`);
  writeJsonFileAtomicSync(messagePath, next);
  return next;
}

export function readSharedMessages(
  cwd: string,
  filter: ReadSharedMessagesFilter = {},
): SharedInteropMessage[] {
  const messagesDir = path.join(getInteropDir(cwd), 'messages');
  if (!existsSync(messagesDir)) {
    return [];
  }

  const messages: SharedInteropMessage[] = [];
  for (const entry of readdirSync(messagesDir)) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    const message = readJsonFileSafe<SharedInteropMessage>(path.join(messagesDir, entry));
    if (!message) {
      continue;
    }

    if (filter.source && message.source !== filter.source) {
      continue;
    }

    if (filter.target && message.target !== filter.target) {
      continue;
    }

    if (filter.unreadOnly && message.read) {
      continue;
    }

    messages.push(message);
  }

  return messages.sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

export function markMessageAsRead(cwd: string, messageId: string): boolean {
  const messagePath = path.join(getInteropDir(cwd), 'messages', `${messageId}.json`);
  const message = readJsonFileSafe<SharedInteropMessage>(messagePath);
  if (!message) {
    return false;
  }

  if (message.read) {
    return true;
  }

  writeJsonFileAtomicSync(messagePath, {
    ...message,
    read: true,
  });

  return true;
}

export function cleanupInterop(
  cwd: string,
  options: {
    keepTasks?: boolean;
    keepMessages?: boolean;
    olderThan?: number;
  } = {},
): { tasksDeleted: number; messagesDeleted: number } {
  const interopDir = getInteropDir(cwd);
  const cutoff = options.olderThan ? Date.now() - options.olderThan : 0;

  let tasksDeleted = 0;
  let messagesDeleted = 0;

  if (!options.keepTasks) {
    const tasksDir = path.join(interopDir, 'tasks');
    if (existsSync(tasksDir)) {
      for (const file of readdirSync(tasksDir)) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(tasksDir, file);
        if (cutoff > 0) {
          const task = readJsonFileSafe<SharedInteropTask>(filePath);
          if (!task) {
            continue;
          }
          if (new Date(task.createdAt).getTime() >= cutoff) {
            continue;
          }
        }

        try {
          unlinkSync(filePath);
          tasksDeleted += 1;
        } catch {
          // Skip non-removable entries.
        }
      }
    }
  }

  if (!options.keepMessages) {
    const messagesDir = path.join(interopDir, 'messages');
    if (existsSync(messagesDir)) {
      for (const file of readdirSync(messagesDir)) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(messagesDir, file);
        if (cutoff > 0) {
          const message = readJsonFileSafe<SharedInteropMessage>(filePath);
          if (!message) {
            continue;
          }
          if (new Date(message.timestamp).getTime() >= cutoff) {
            continue;
          }
        }

        try {
          unlinkSync(filePath);
          messagesDeleted += 1;
        } catch {
          // Skip non-removable entries.
        }
      }
    }
  }

  return {
    tasksDeleted,
    messagesDeleted,
  };
}

export interface OmgWorkerInfo {
  name: string;
  index: number;
  role: string;
  assigned_tasks: string[];
  pid?: number;
  pane_id?: string;
}

export interface OmgTeamConfig {
  name: string;
  task: string;
  backend: string;
  worker_count: number;
  max_workers: number;
  workers: OmgWorkerInfo[];
  created_at: string;
  next_task_id: number;
}

export interface OmgTeamTask {
  id: string;
  subject: string;
  description: string;
  status: PersistedTaskRecord['status'];
  owner?: string;
  result?: string;
  error?: string;
  blocked_by?: string[];
  depends_on?: string[];
  version?: number;
  created_at: string;
  completed_at?: string;
}

export interface OmgTeamMailboxMessage {
  message_id: string;
  from_worker: string;
  to_worker: string;
  body: string;
  created_at: string;
  notified_at?: string;
  delivered_at?: string;
}

function taskRecordToInteropTask(task: PersistedTaskRecord): OmgTeamTask {
  return {
    id: task.id,
    subject: task.subject,
    description: task.description ?? '',
    status: task.status,
    owner: task.owner,
    result: task.result,
    error: task.error,
    blocked_by: task.dependsOn ?? task.depends_on,
    depends_on: task.dependsOn ?? task.depends_on,
    version: task.version,
    created_at: task.createdAt,
    completed_at:
      task.status === 'completed' || task.status === 'failed'
        ? task.updatedAt
        : undefined,
  };
}

function mailboxMessageToInteropMessage(
  message: PersistedMailboxMessage,
): OmgTeamMailboxMessage {
  return {
    message_id: message.messageId,
    from_worker: message.fromWorker,
    to_worker: message.toWorker,
    body: message.body,
    created_at: message.createdAt,
    notified_at: message.notifiedAt,
    delivered_at: message.deliveredAt,
  };
}

function readRunRequestSafe(
  cwd: string,
  teamName: string,
): Promise<Record<string, unknown> | null> {
  const runRequestPath = path.join(
    cwd,
    '.omg',
    'state',
    'team',
    teamName,
    'run-request.json',
  );

  return fs
    .readFile(runRequestPath, 'utf8')
    .then((raw) => JSON.parse(raw) as Record<string, unknown>)
    .catch(() => null);
}

function parseTaskSequence(taskId: string): number {
  const numeric = Number.parseInt(taskId.replace(/^task-/, ''), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDateString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const epoch = Date.parse(value);
  if (Number.isNaN(epoch)) {
    return null;
  }

  return new Date(epoch).toISOString();
}

export async function listOmgTeams(cwd: string): Promise<string[]> {
  const stateStore = new TeamStateStore({ cwd });
  const teamsRoot = path.join(stateStore.rootDir, 'team');

  try {
    const entries = await fs.readdir(teamsRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export async function readOmgTeamConfig(
  teamName: string,
  cwd: string,
): Promise<OmgTeamConfig | null> {
  const stateStore = new TeamStateStore({ cwd });
  const teamDir = stateStore.getTeamDir(teamName);

  try {
    const stat = await fs.stat(teamDir);
    if (!stat.isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }

  const [runRequest, snapshot, tasks, workers, mailboxWorkers] = await Promise.all([
    readRunRequestSafe(cwd, teamName),
    stateStore.readMonitorSnapshot(teamName),
    stateStore.listTasks(teamName),
    stateStore.listWorkers(teamName),
    stateStore.listMailboxWorkers(teamName),
  ]);

  const workerNames = [...new Set([...workers, ...mailboxWorkers])].sort((a, b) =>
    a.localeCompare(b),
  );

  const task =
    (typeof runRequest?.task === 'string' && runRequest.task.trim()) ||
    snapshot?.summary ||
    'interoperability-team';

  const backend =
    (typeof runRequest?.backend === 'string' && runRequest.backend.trim()) ||
    snapshot?.backend ||
    'tmux';

  const workerInfos: OmgWorkerInfo[] = workerNames.map((worker, index) => ({
    name: worker,
    index,
    role: 'gemini',
    assigned_tasks: [],
  }));

  const createdAt =
    parseDateString(runRequest?.updatedAt) ||
    parseDateString(snapshot?.updatedAt) ||
    new Date().toISOString();

  const nextTaskId = tasks.reduce((max, item) => {
    const seq = parseTaskSequence(item.id);
    return Math.max(max, seq + 1);
  }, 1);

  return {
    name: teamName,
    task,
    backend,
    worker_count: workerInfos.length,
    max_workers: workerInfos.length,
    workers: workerInfos,
    created_at: createdAt,
    next_task_id: nextTaskId,
  };
}

export async function listOmgTasks(
  teamName: string,
  cwd: string,
): Promise<OmgTeamTask[]> {
  const stateStore = new TeamStateStore({ cwd });
  const tasks = await stateStore.listTasks(teamName);

  return tasks
    .map((task) => taskRecordToInteropTask(task))
    .sort((left, right) => parseTaskSequence(left.id) - parseTaskSequence(right.id));
}

export async function readOmgMailbox(
  teamName: string,
  workerName: string,
  cwd: string,
): Promise<{ worker: string; messages: OmgTeamMailboxMessage[] }> {
  const stateStore = new TeamStateStore({ cwd });
  const messages = await stateStore.listMailboxMessages(teamName, workerName);
  return {
    worker: workerName,
    messages: messages.map((message) => mailboxMessageToInteropMessage(message)),
  };
}

export async function listOmgMailboxMessages(
  teamName: string,
  workerName: string,
  cwd: string,
): Promise<OmgTeamMailboxMessage[]> {
  const mailbox = await readOmgMailbox(teamName, workerName, cwd);
  return mailbox.messages;
}

export async function sendOmgDirectMessage(
  teamName: string,
  fromWorker: string,
  toWorker: string,
  body: string,
  cwd: string,
): Promise<OmgTeamMailboxMessage> {
  const controlPlane = new TeamControlPlane({ cwd });

  const persisted = await controlPlane.sendMailboxMessage({
    teamName,
    fromWorker,
    toWorker,
    body,
    messageId: randomUUID(),
  });

  return mailboxMessageToInteropMessage(persisted);
}

export async function broadcastOmgMessage(
  teamName: string,
  fromWorker: string,
  body: string,
  cwd: string,
): Promise<OmgTeamMailboxMessage[]> {
  const config = await readOmgTeamConfig(teamName, cwd);
  if (!config) {
    throw new Error(`OMG team ${teamName} not found.`);
  }

  const recipients = config.workers
    .map((worker) => worker.name)
    .filter((workerName) => workerName !== fromWorker);

  const delivered = await Promise.all(
    recipients.map((workerName) =>
      sendOmgDirectMessage(teamName, fromWorker, workerName, body, cwd),
    ),
  );

  return delivered;
}
