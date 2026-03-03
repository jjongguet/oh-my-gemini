export type PersistedLifecyclePhase =
  | 'plan'
  | 'exec'
  | 'verify'
  | 'fix'
  | 'completed'
  | 'failed';

/**
 * Compatibility union for legacy state artifacts that used `complete`.
 * New writes should always normalize to `completed`.
 */
export type PersistedLifecyclePhaseValue =
  | PersistedLifecyclePhase
  | 'complete';

/**
 * Backward-compatible alias retained for older imports.
 */
export type PersistedLifecyclePhaseCompat = PersistedLifecyclePhaseValue;

export interface PersistedPhaseTransitionEvent {
  teamName: string;
  runId: string;
  from: PersistedLifecyclePhaseValue;
  to: PersistedLifecyclePhaseValue;
  at: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PersistedTeamPhaseState {
  teamName: string;
  runId: string;
  currentPhase: PersistedLifecyclePhaseValue;
  maxFixAttempts: number;
  currentFixAttempt: number;
  transitions: PersistedPhaseTransitionEvent[];
  updatedAt: string;
  lastError?: string;
}

export interface PersistedWorkerSnapshot {
  workerId: string;
  status: string;
  lastHeartbeatAt?: string;
  details?: string;
}

export interface PersistedTeamSnapshot {
  runId: string;
  teamName: string;
  handleId: string;
  backend: string;
  status: string;
  updatedAt: string;
  summary?: string;
  failureReason?: string;
  runtime?: Record<string, unknown>;
  workers: PersistedWorkerSnapshot[];
}

export interface PersistedWorkerHeartbeat {
  runId?: string;
  teamName: string;
  workerName: string;
  alive: boolean;
  pid?: number;
  turnCount?: number;
  currentTaskId?: string;
  updatedAt: string;
}

export interface PersistedWorkerStatus {
  runId?: string;
  state: 'idle' | 'in_progress' | 'blocked' | 'failed' | 'unknown';
  currentTaskId?: string;
  reason?: string;
  updatedAt: string;
}

export interface PersistedWorkerIdentity {
  runId?: string;
  teamName: string;
  workerName: string;
  role?: string;
  index?: number;
  paneId?: string;
  teamStateRoot?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface PersistedWorkerDoneSignal {
  runId?: string;
  teamName: string;
  workerName: string;
  status: 'completed' | 'failed';
  completedAt: string;
  summary?: string;
  error?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export type PersistedTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'unknown'
  | 'cancelled'
  | 'canceled';

export interface PersistedTaskClaim {
  owner: string;
  token: string;
  leasedUntil: string;
  leased_until?: string;
}

export interface PersistedTaskRecord {
  id: string;
  teamName?: string;
  team_name?: string;
  subject: string;
  description?: string;
  status: PersistedTaskStatus;
  required?: boolean;
  owner?: string;
  dependsOn?: string[];
  depends_on?: string[];
  requiresCodeChange?: boolean;
  requires_code_change?: boolean;
  claim?: PersistedTaskClaim;
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type PersistedTaskAuditAction =
  | 'claim'
  | 'transition'
  | 'release';

export interface PersistedTaskAuditEvent {
  eventId: string;
  teamName: string;
  team_name?: string;
  taskId: string;
  task_id?: string;
  action: PersistedTaskAuditAction;
  worker: string;
  at: string;
  fromStatus?: PersistedTaskStatus;
  from_status?: PersistedTaskStatus;
  toStatus?: PersistedTaskStatus;
  to_status?: PersistedTaskStatus;
  claimTokenDigest?: string;
  claim_token_digest?: string;
  leasedUntil?: string;
  leased_until?: string;
  reasonCode?: string;
  reason_code?: string;
  metadata?: Record<string, unknown>;
  event_id?: string;
}

/**
 * Backward-compatible alias retained for older imports.
 */
export type PersistedTaskState = PersistedTaskRecord;

export interface PersistedMailboxMessage {
  messageId: string;
  fromWorker: string;
  toWorker: string;
  body: string;
  createdAt: string;
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
