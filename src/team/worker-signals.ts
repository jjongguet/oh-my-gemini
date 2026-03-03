import type { PersistedWorkerDoneSignal, PersistedWorkerHeartbeat } from '../state/index.js';

export function buildHeartbeatSignal(params: {
  teamName: string;
  workerName: string;
  alive: boolean;
  pid?: number;
  turnCount?: number;
  currentTaskId?: string;
}): PersistedWorkerHeartbeat {
  return {
    teamName: params.teamName,
    workerName: params.workerName,
    alive: params.alive,
    pid: params.pid,
    turnCount: params.turnCount,
    currentTaskId: params.currentTaskId,
    updatedAt: new Date().toISOString(),
  };
}

export function buildDoneSignal(params: {
  teamName: string;
  workerName: string;
  status: 'completed' | 'failed';
  summary?: string;
  error?: string;
  taskId?: string;
}): PersistedWorkerDoneSignal {
  return {
    teamName: params.teamName,
    workerName: params.workerName,
    status: params.status,
    completedAt: new Date().toISOString(),
    summary: params.summary,
    error: params.error,
    taskId: params.taskId,
  };
}
