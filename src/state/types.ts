export type PersistedLifecyclePhase =
  | 'plan'
  | 'exec'
  | 'verify'
  | 'fix'
  | 'completed'
  | 'failed';

export interface PersistedPhaseTransitionEvent {
  teamName: string;
  runId: string;
  from: PersistedLifecyclePhase;
  to: PersistedLifecyclePhase;
  at: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PersistedTeamPhaseState {
  teamName: string;
  runId: string;
  currentPhase: PersistedLifecyclePhase;
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
