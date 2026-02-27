import type { RuntimeBackendName } from './runtime/runtime-backend.js';

export type TeamLifecyclePhase =
  | 'plan'
  | 'exec'
  | 'verify'
  | 'fix'
  | 'completed'
  | 'failed';

export type TeamRuntimeStatus =
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'unknown';

export type WorkerRuntimeStatus =
  | 'idle'
  | 'running'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'unknown';

export interface WorkerSnapshot {
  workerId: string;
  status: WorkerRuntimeStatus;
  lastHeartbeatAt?: string;
  details?: string;
}

export interface TeamSubagentDefinition {
  id: string;
  role: string;
  mission: string;
  model: string;
}

export interface TeamSubagentCatalog {
  schemaVersion: number;
  unifiedModel: string;
  sourcePath?: string;
  subagents: TeamSubagentDefinition[];
}

export interface TeamStartInput {
  teamName: string;
  task: string;
  cwd: string;
  backend?: RuntimeBackendName;
  workers?: number;
  command?: string;
  env?: Record<string, string>;
  subagents?: string[];
  maxFixAttempts?: number;
  watchdogMs?: number;
  nonReportingMs?: number;
  metadata?: Record<string, unknown>;
}

export interface TeamHandle {
  id: string;
  teamName: string;
  backend: RuntimeBackendName;
  cwd: string;
  startedAt: string;
  runtime: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TeamSnapshot {
  handleId: string;
  teamName: string;
  backend: RuntimeBackendName;
  status: TeamRuntimeStatus;
  phase?: TeamLifecyclePhase;
  updatedAt: string;
  workers: WorkerSnapshot[];
  summary?: string;
  failureReason?: string;
  runtime?: Record<string, unknown>;
}

export interface TeamRunResult {
  success: boolean;
  status: 'completed' | 'failed';
  phase: TeamLifecyclePhase;
  attempts: number;
  backend: RuntimeBackendName;
  handle?: TeamHandle;
  snapshot?: TeamSnapshot;
  error?: string;
  issues?: string[];
}

export interface TeamPhaseTransition {
  from: TeamLifecyclePhase;
  to: TeamLifecyclePhase;
  at: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
