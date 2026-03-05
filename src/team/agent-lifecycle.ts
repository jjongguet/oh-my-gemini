import type { TeamSubagentDefinition } from './types.js';

export type AgentLifecycleStatus =
  | 'planned'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface AgentLifecycleRecord {
  agentId: string;
  roleId: string;
  workerId: string;
  status: AgentLifecycleStatus;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  summary?: string;
  artifacts: string[];
}

export interface AgentLifecycleSummary {
  total: number;
  byStatus: Record<AgentLifecycleStatus, number>;
  terminal: boolean;
  completed: number;
  failed: number;
  nonTerminal: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readArtifacts(output: Record<string, unknown> | undefined): string[] {
  if (!output) {
    return [];
  }

  const artifacts = output.artifacts;
  if (!isRecord(artifacts)) {
    return [];
  }

  const refs: string[] = [];
  for (const raw of Object.values(artifacts)) {
    const ref = readString(raw);
    if (!ref) {
      continue;
    }

    refs.push(ref);
  }

  return refs;
}

export function deriveAgentLifecycleStatus(
  roleOutputStatus: string | undefined,
): AgentLifecycleStatus {
  const normalized = readString(roleOutputStatus)?.toLowerCase();

  switch (normalized) {
    case 'planned':
      return 'planned';
    case 'running':
    case 'in_progress':
      return 'running';
    case 'blocked':
      return 'blocked';
    case 'completed':
    case 'done':
    case 'success':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'unknown';
  }
}

export function summarizeAgentLifecycle(
  records: AgentLifecycleRecord[],
): AgentLifecycleSummary {
  const byStatus: Record<AgentLifecycleStatus, number> = {
    planned: 0,
    running: 0,
    blocked: 0,
    completed: 0,
    failed: 0,
    unknown: 0,
  };

  for (const record of records) {
    byStatus[record.status] += 1;
  }

  const completed = byStatus.completed;
  const failed = byStatus.failed;
  const nonTerminal = byStatus.planned + byStatus.running + byStatus.blocked;

  return {
    total: records.length,
    byStatus,
    terminal: nonTerminal === 0,
    completed,
    failed,
    nonTerminal,
  };
}

export function buildInitialAgentLifecycleRecords(params: {
  selectedSubagents: TeamSubagentDefinition[];
  startedAt: string;
}): AgentLifecycleRecord[] {
  const { selectedSubagents, startedAt } = params;

  return selectedSubagents.map((subagent, index) => ({
    agentId: subagent.id,
    roleId: subagent.role,
    workerId: `worker-${index + 1}`,
    status: 'running',
    startedAt,
    updatedAt: startedAt,
    artifacts: [],
    summary: `Agent ${subagent.id} accepted assignment ${index + 1}/${selectedSubagents.length}.`,
  }));
}

export function buildAgentLifecycleRecords(params: {
  selectedSubagents: TeamSubagentDefinition[];
  roleOutputs: Record<string, unknown>[];
  observedAt: string;
  startedAtByWorkerId?: Record<string, string>;
}): AgentLifecycleRecord[] {
  const { selectedSubagents, roleOutputs, observedAt, startedAtByWorkerId } = params;

  const outputByWorkerId = new Map<string, Record<string, unknown>>();
  for (const roleOutput of roleOutputs) {
    const workerId = readString(roleOutput.workerId);
    if (!workerId) {
      continue;
    }
    outputByWorkerId.set(workerId, roleOutput);
  }

  return selectedSubagents.map((subagent, index) => {
    const workerId = `worker-${index + 1}`;
    const roleOutput = outputByWorkerId.get(workerId);
    const status = deriveAgentLifecycleStatus(readString(roleOutput?.status));
    const startedAt = startedAtByWorkerId?.[workerId];
    const completedAt = status === 'completed' || status === 'failed'
      ? observedAt
      : undefined;

    return {
      agentId: subagent.id,
      roleId: subagent.role,
      workerId,
      status,
      startedAt,
      completedAt,
      updatedAt: observedAt,
      summary: readString(roleOutput?.summary),
      artifacts: readArtifacts(roleOutput),
    };
  });
}
