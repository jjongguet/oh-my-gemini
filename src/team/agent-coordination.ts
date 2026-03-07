import type { TeamSubagentDefinition } from './types.js';

export interface AgentCoordinationEdge {
  from: string;
  to: string;
  reason: string;
}

export interface AgentCoordinationStep {
  stage: number;
  workerIds: string[];
  agentIds: string[];
  roleIds: string[];
  dependsOn: string[];
}

export interface AgentCoordinationPlan {
  strategy: 'omc-role-aware';
  steps: AgentCoordinationStep[];
  handoffs: AgentCoordinationEdge[];
}

function normalizeRoleToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function includesRoleToken(subagent: TeamSubagentDefinition, token: string): boolean {
  const target = normalizeRoleToken(token);
  if (!target) {
    return false;
  }

  const candidates = [subagent.id, subagent.role, ...(subagent.aliases ?? [])];
  return candidates.some((candidate) => normalizeRoleToken(candidate) === target);
}

function findWorkerIdByRoleToken(
  subagents: TeamSubagentDefinition[],
  roleToken: string,
): string | undefined {
  const index = subagents.findIndex((subagent) => includesRoleToken(subagent, roleToken));
  return index >= 0 ? `worker-${index + 1}` : undefined;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

function stageAssignments(subagents: TeamSubagentDefinition[]): string[][] {
  const planStage = dedupe(
    [
      findWorkerIdByRoleToken(subagents, 'analyst'),
      findWorkerIdByRoleToken(subagents, 'planner'),
      findWorkerIdByRoleToken(subagents, 'architect'),
      findWorkerIdByRoleToken(subagents, 'critic'),
    ].filter((value): value is string => value !== undefined),
  );

  const verifyStage = dedupe(
    [
      findWorkerIdByRoleToken(subagents, 'verifier'),
      findWorkerIdByRoleToken(subagents, 'qa-tester'),
      findWorkerIdByRoleToken(subagents, 'quality-reviewer'),
      findWorkerIdByRoleToken(subagents, 'security-reviewer'),
      findWorkerIdByRoleToken(subagents, 'code-reviewer'),
      findWorkerIdByRoleToken(subagents, 'writer'),
    ].filter((value): value is string => value !== undefined),
  );

  const reserved = new Set([...planStage, ...verifyStage]);
  const executeStage = subagents
    .map((_, index) => `worker-${index + 1}`)
    .filter((workerId) => !reserved.has(workerId));

  const stages = [planStage, executeStage, verifyStage].filter(
    (group) => group.length > 0,
  );

  if (stages.length === 0) {
    return [subagents.map((_, index) => `worker-${index + 1}`)];
  }

  return stages;
}

function buildCoordinationStep(
  workerIds: string[],
  subagents: TeamSubagentDefinition[],
  stage: number,
  dependsOn: string[],
): AgentCoordinationStep {
  const agentIds: string[] = [];
  const roleIds: string[] = [];

  for (const workerId of workerIds) {
    const index = Number(workerId.replace('worker-', '')) - 1;
    const subagent = subagents[index];
    if (!subagent) {
      continue;
    }
    agentIds.push(subagent.id);
    roleIds.push(subagent.role);
  }

  return {
    stage,
    workerIds,
    agentIds,
    roleIds,
    dependsOn,
  };
}

function buildHandoffEdges(
  steps: AgentCoordinationStep[],
): AgentCoordinationEdge[] {
  if (steps.length <= 1) {
    return [];
  }

  const edges: AgentCoordinationEdge[] = [];
  for (let index = 1; index < steps.length; index += 1) {
    const fromStage = steps[index - 1];
    const toStage = steps[index];
    if (!fromStage || !toStage) {
      continue;
    }

    for (const fromWorker of fromStage.workerIds) {
      for (const toWorker of toStage.workerIds) {
        edges.push({
          from: fromWorker,
          to: toWorker,
          reason: `stage-${fromStage.stage}-to-stage-${toStage.stage}`,
        });
      }
    }
  }

  return edges;
}

export function createAgentCoordinationPlan(
  selectedSubagents: TeamSubagentDefinition[],
): AgentCoordinationPlan {
  const stagedWorkers = stageAssignments(selectedSubagents);
  const steps: AgentCoordinationStep[] = [];

  for (let stageIndex = 0; stageIndex < stagedWorkers.length; stageIndex += 1) {
    const workerIds = stagedWorkers[stageIndex] ?? [];
    const dependsOn = stageIndex === 0
      ? []
      : [...(stagedWorkers[stageIndex - 1] ?? [])];
    steps.push(
      buildCoordinationStep(workerIds, selectedSubagents, stageIndex + 1, dependsOn),
    );
  }

  return {
    strategy: 'omc-role-aware',
    steps,
    handoffs: buildHandoffEdges(steps),
  };
}
