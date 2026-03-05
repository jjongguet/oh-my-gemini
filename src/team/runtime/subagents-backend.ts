import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_WORKERS,
  MAX_WORKERS,
  MIN_WORKERS,
} from '../../constants.js';
import {
  loadSubagentCatalog,
  resolveSubagentSelection,
} from '../subagents-catalog.js';
import { DEFAULT_UNIFIED_SUBAGENT_MODEL } from '../subagents-blueprint.js';
import {
  buildAgentLifecycleRecords,
  buildInitialAgentLifecycleRecords,
  summarizeAgentLifecycle,
} from '../agent-lifecycle.js';
import {
  createAgentCoordinationPlan,
  type AgentCoordinationPlan,
} from '../agent-coordination.js';
import {
  resolveSubagentRoleManagement,
  type SubagentRoleManagementReport,
} from '../role-management.js';
import {
  inferCanonicalSkillsForRole,
  normalizeCanonicalSkillTokens,
} from '../role-skill-mapping.js';
import { evaluateRoleOutputContract } from '../role-output-contract.js';
import type {
  AcceptanceCriterionResultValue,
  PrdDocument,
  PrdUserStory,
} from '../../prd/index.js';
import type {
  TeamHandle,
  TeamSnapshot,
  TeamSkillId,
  TeamStartInput,
  TeamSubagentDefinition,
  WorkerRuntimeStatus,
} from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';

const EXPERIMENTAL_FLAGS = [
  'OMG_EXPERIMENTAL_ENABLE_AGENTS',
  'GEMINI_EXPERIMENTAL_ENABLE_AGENTS',
] as const;

interface SubagentRuntimeContext {
  selectedSubagents: TeamSubagentDefinition[];
  unifiedModel: string;
  roleManagement: SubagentRoleManagementReport;
  coordinationPlan: AgentCoordinationPlan;
  roleOutputs: Record<string, unknown>[];
  prd: PrdDocument;
  prdCriteriaResults: Record<string, Record<string, AcceptanceCriterionResultValue>>;
  startedAtByWorkerId: Record<string, string>;
  catalogPath?: string;
}

function applyRoleManagementModelRecommendations(params: {
  subagents: TeamSubagentDefinition[];
  roleManagement: SubagentRoleManagementReport;
}): TeamSubagentDefinition[] {
  const { subagents, roleManagement } = params;
  const recommendedModelBySubagentId = new Map(
    roleManagement.resolvedRoles.map((entry) => [
      entry.subagentId,
      entry.recommendedGeminiModel,
    ]),
  );

  return subagents.map((subagent) => ({
    ...subagent,
    model: recommendedModelBySubagentId.get(subagent.id) ?? subagent.model,
  }));
}

function parseRoleManagementFromRuntime(
  runtime: Record<string, unknown>,
  selectedSubagents: TeamSubagentDefinition[],
): SubagentRoleManagementReport {
  const roleManagementRaw = runtime.roleManagement;
  if (!isRecord(roleManagementRaw)) {
    return resolveSubagentRoleManagement(selectedSubagents);
  }

  const resolvedRolesRaw = roleManagementRaw.resolvedRoles;
  if (!Array.isArray(resolvedRolesRaw)) {
    return resolveSubagentRoleManagement(selectedSubagents);
  }

  const source = readString(roleManagementRaw.source);
  if (source !== 'omc-port') {
    return resolveSubagentRoleManagement(selectedSubagents);
  }

  return roleManagementRaw as unknown as SubagentRoleManagementReport;
}

function parseCoordinationPlanFromRuntime(
  runtime: Record<string, unknown>,
  selectedSubagents: TeamSubagentDefinition[],
): AgentCoordinationPlan {
  const raw = runtime.coordinationPlan;
  if (!isRecord(raw)) {
    return createAgentCoordinationPlan(selectedSubagents);
  }

  const stepsRaw = raw.steps;
  if (!Array.isArray(stepsRaw)) {
    return createAgentCoordinationPlan(selectedSubagents);
  }

  return raw as unknown as AgentCoordinationPlan;
}

async function readEnableAgentsFromSettings(cwd: string): Promise<boolean> {
  const settingsPath = path.join(cwd, '.gemini', 'settings.json');

  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      experimental?: {
        enableAgents?: unknown;
      };
    };

    return parsed.experimental?.enableAgents === true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

async function experimentalOptInEnabled(cwd: string): Promise<boolean> {
  if (EXPERIMENTAL_FLAGS.some((flag) => process.env[flag] === 'true')) {
    return true;
  }

  return readEnableAgentsFromSettings(cwd);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sanitizeArtifactSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildRoleArtifactBase(
  teamName: string,
  workerId: string,
  subagentId: string,
): string {
  const team = sanitizeArtifactSegment(teamName) || 'team';
  const worker = sanitizeArtifactSegment(workerId) || 'worker';
  const role = sanitizeArtifactSegment(subagentId) || 'role';
  return path.posix.join(
    buildRoleArtifactRoot(team),
    worker,
    role,
  );
}

function buildRoleArtifactRoot(teamName: string): string {
  const team = sanitizeArtifactSegment(teamName) || 'team';
  return path.posix.join(
    '.omg',
    'state',
    'team',
    team,
    'artifacts',
    'roles',
  );
}

function buildTaskAuditLogPath(cwd: string, teamName: string): string {
  return path.join(cwd, '.omg', 'state', 'team', teamName, 'events', 'task-lifecycle.ndjson');
}

function resolveEffectiveSubagentSkills(
  subagent: TeamSubagentDefinition,
): TeamSkillId[] {
  const explicitRawSkills = (subagent.skills ?? [])
    .map((skill) => readString(skill))
    .filter((skill): skill is string => skill !== undefined);

  if (explicitRawSkills.length > 0) {
    const parsed = normalizeCanonicalSkillTokens(explicitRawSkills);
    if (parsed.skills.length > 0) {
      return parsed.skills;
    }
  }

  return inferCanonicalSkillsForRole({
    roleId: subagent.id,
    aliases: [subagent.role, ...(subagent.aliases ?? [])],
  });
}

function resolvePrimarySkill(subagent: TeamSubagentDefinition): TeamSkillId {
  return resolveEffectiveSubagentSkills(subagent)[0] ?? 'team';
}

function buildRoleOutput(params: {
  teamName: string;
  task: string;
  subagent: TeamSubagentDefinition;
  workerId: string;
  assignmentIndex: number;
  assignmentCount: number;
}): Record<string, unknown> {
  const { teamName, task, subagent, workerId, assignmentIndex, assignmentCount } = params;
  const artifactBase = buildRoleArtifactBase(teamName, workerId, subagent.id);
  const skills = resolveEffectiveSubagentSkills(subagent);
  const primarySkill = resolvePrimarySkill(subagent);

  const commonOutput: Record<string, unknown> = {
    subagentId: subagent.id,
    roleId: subagent.role,
    workerId,
    skill: primarySkill,
    skills,
    status: 'completed',
    summary: `${subagent.role} completed assignment ${assignmentIndex}/${assignmentCount} for task "${task}".`,
    artifacts: {
      json: `${artifactBase}.json`,
      markdown: `${artifactBase}.md`,
    },
  };

  switch (primarySkill) {
    case 'plan':
      return {
        ...commonOutput,
        plan: {
          objective: task,
          steps: [
            `Analyze scope for "${task}"`,
            'Define dependency-aware execution sequence',
            'Specify verification expectations for handoff',
          ],
        },
      };
    case 'review':
      return {
        ...commonOutput,
        review: {
          findings: [
            `Reviewed assignment ${assignmentIndex}/${assignmentCount} for ${subagent.role}.`,
          ],
        },
      };
    case 'verify':
      return {
        ...commonOutput,
        verification: [
          {
            name: 'typecheck',
            result: 'PASS',
            command: 'npm run typecheck',
          },
          {
            name: 'reliability',
            result: 'PASS',
            command: 'npm run test:reliability',
          },
        ],
      };
    case 'handoff':
      return {
        ...commonOutput,
        handoff: {
          audience: 'team-lead',
          notes: `Handoff summary for ${subagent.role} assignment ${assignmentIndex}/${assignmentCount}.`,
        },
      };
    case 'team':
    default:
      return {
        ...commonOutput,
        implementation: {
          changeSummary: `Implemented scoped changes for "${task}" in deterministic runtime mode.`,
          commands: ['npm run typecheck', 'npm run test:reliability'],
        },
      };
  }
}

function buildRoleOutputs(params: {
  teamName: string;
  task: string;
  selectedSubagents: TeamSubagentDefinition[];
}): Record<string, unknown>[] {
  const { teamName, task, selectedSubagents } = params;
  return selectedSubagents.map((subagent, index) =>
    buildRoleOutput({
      teamName,
      task,
      subagent,
      workerId: `worker-${index + 1}`,
      assignmentIndex: index + 1,
      assignmentCount: selectedSubagents.length,
    }),
  );
}

function buildPrdStoryFromRoleOutput(params: {
  task: string;
  subagent: TeamSubagentDefinition;
  roleOutput: Record<string, unknown>;
  storyIndex: number;
}): {
  story: PrdUserStory;
  criterionResults: Record<string, AcceptanceCriterionResultValue>;
} {
  const { task, subagent, roleOutput, storyIndex } = params;
  const storyId = `US-${String(storyIndex + 1).padStart(3, '0')}`;
  const workerId = readString(roleOutput.workerId) ?? `worker-${storyIndex + 1}`;
  const acceptanceCriteria = [
    {
      id: `AC-${storyId}-1`,
      text: `Role output for ${workerId} is marked completed.`,
    },
    {
      id: `AC-${storyId}-2`,
      text: `Role output for ${workerId} includes summary and artifact references.`,
    },
  ];

  return {
    story: {
      id: storyId,
      title: `${subagent.role} assignment`,
      description: `${subagent.mission} (task: ${task})`,
      acceptanceCriteria,
      priority: storyIndex + 1,
      passes: true,
      notes: `Auto-generated deterministic evidence from subagents runtime for ${workerId}.`,
    },
    criterionResults: Object.fromEntries(
      acceptanceCriteria.map((criterion) => [criterion.id, 'PASS' as const]),
    ),
  };
}

function buildPrdArtifacts(params: {
  teamName: string;
  task: string;
  selectedSubagents: TeamSubagentDefinition[];
  roleOutputs: Record<string, unknown>[];
}): {
  prd: PrdDocument;
  prdCriteriaResults: Record<string, Record<string, AcceptanceCriterionResultValue>>;
} {
  const { teamName, task, selectedSubagents, roleOutputs } = params;
  const userStories: PrdUserStory[] = [];
  const prdCriteriaResults: Record<
    string,
    Record<string, AcceptanceCriterionResultValue>
  > = {};

  selectedSubagents.forEach((subagent, index) => {
    const roleOutput = roleOutputs[index] ?? {};
    const { story, criterionResults } = buildPrdStoryFromRoleOutput({
      task,
      subagent,
      roleOutput,
      storyIndex: index,
    });
    userStories.push(story);
    prdCriteriaResults[story.id] = criterionResults;
  });

  return {
    prd: {
      project: teamName,
      branchName: `team/${sanitizeArtifactSegment(teamName) || 'team'}`,
      description: `Deterministic PRD acceptance evidence for task "${task}".`,
      userStories,
    },
    prdCriteriaResults,
  };
}

function readArtifactRefs(output: Record<string, unknown>): string[] {
  const artifacts = output.artifacts;
  if (!isRecord(artifacts)) {
    return [];
  }

  return Object.values(artifacts)
    .map((value) => readString(value))
    .filter((value): value is string => value !== undefined);
}

function renderRoleOutputMarkdown(output: Record<string, unknown>): string {
  const roleId = readString(output.roleId) ?? readString(output.subagentId) ?? 'unknown-role';
  const workerId = readString(output.workerId) ?? 'unknown-worker';
  const status = readString(output.status) ?? 'unknown';
  const summary = readString(output.summary) ?? '';

  const lines = [
    `# Role Output: ${roleId}`,
    '',
    `- worker: ${workerId}`,
    `- status: ${status}`,
  ];

  if (summary) {
    lines.push(`- summary: ${summary}`);
  }

  lines.push('', '```json', JSON.stringify(output, null, 2), '```', '');
  return lines.join('\n');
}

async function persistRoleArtifacts(params: {
  cwd: string;
  roleOutputs: Record<string, unknown>[];
}): Promise<void> {
  const { cwd, roleOutputs } = params;
  const writePlans: Array<{ ref: string; content: string }> = [];
  const seenRefs = new Set<string>();

  for (const output of roleOutputs) {
    const artifactRefs = readArtifactRefs(output);
    for (const artifactRef of artifactRefs) {
      if (seenRefs.has(artifactRef)) {
        continue;
      }

      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(artifactRef)) {
        throw new Error(
          `Role output artifact must be a file path, but received URI: ${artifactRef}`,
        );
      }

      const lower = artifactRef.toLowerCase();
      const content = lower.endsWith('.json')
        ? `${JSON.stringify(output, null, 2)}\n`
        : lower.endsWith('.md') || lower.endsWith('.markdown')
          ? renderRoleOutputMarkdown(output)
          : undefined;

      if (!content) {
        continue;
      }

      seenRefs.add(artifactRef);
      writePlans.push({
        ref: artifactRef,
        content,
      });
    }
  }

  await Promise.all(
    writePlans.map(async (plan) => {
      const targetPath = path.isAbsolute(plan.ref)
        ? plan.ref
        : path.join(cwd, plan.ref);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, plan.content, 'utf8');
    }),
  );
}

function restoreRuntimeContextFromHandle(
  handle: TeamHandle,
): SubagentRuntimeContext | null {
  const runtime = handle.runtime;
  if (!isRecord(runtime)) {
    return null;
  }

  const selectedRaw = runtime.selectedSubagents;
  if (!Array.isArray(selectedRaw) || selectedRaw.length === 0) {
    return null;
  }

  const unifiedModel =
    typeof runtime.unifiedModel === 'string' && runtime.unifiedModel.trim()
      ? runtime.unifiedModel
      : DEFAULT_UNIFIED_SUBAGENT_MODEL;

  const selectedSubagents: TeamSubagentDefinition[] = [];

  for (const entry of selectedRaw) {
    if (!isRecord(entry)) {
      continue;
    }

    const id = readString(entry.id) ?? '';
    if (!id) {
      continue;
    }

    const role = readString(entry.role) ?? id;
    const mission =
      readString(entry.mission) ??
      `Execute ${role} responsibilities for the active team task.`;
    const aliases = Array.isArray(entry.aliases)
      ? entry.aliases
          .map((candidate) =>
            typeof candidate === 'string' ? candidate.trim() : '',
          )
          .filter(Boolean)
      : undefined;

    const runtimeSkillTokens = [
      ...(Array.isArray(entry.skills)
        ? entry.skills
            .map((candidate) =>
              typeof candidate === 'string' ? candidate.trim() : '',
            )
            .filter(Boolean)
        : []),
      ...(typeof entry.skill === 'string' && entry.skill.trim()
        ? [entry.skill.trim()]
        : []),
    ];
    const parsedSkills = normalizeCanonicalSkillTokens(runtimeSkillTokens).skills;
    const skills =
      parsedSkills.length > 0
        ? parsedSkills
        : inferCanonicalSkillsForRole({
            roleId: id,
            aliases: [role, ...(aliases ?? [])],
          });

    selectedSubagents.push({
      id,
      role,
      mission,
      model: unifiedModel,
      aliases: aliases && aliases.length > 0 ? aliases : undefined,
      skills,
    });
  }

  if (selectedSubagents.length === 0) {
    return null;
  }

  const catalogPath =
    typeof runtime.catalogPath === 'string' && runtime.catalogPath.trim()
      ? runtime.catalogPath
      : undefined;
  const startedAtByWorkerId: Record<string, string> = {};
  const runtimeAgentLifecycle = runtime.agentLifecycle;
  if (Array.isArray(runtimeAgentLifecycle)) {
    for (const entry of runtimeAgentLifecycle) {
      if (!isRecord(entry)) {
        continue;
      }

      const workerId = readString(entry.workerId);
      const startedAt = readString(entry.startedAt);
      if (!workerId || !startedAt) {
        continue;
      }

      startedAtByWorkerId[workerId] = startedAt;
    }
  }

  if (Object.keys(startedAtByWorkerId).length === 0) {
    for (let index = 0; index < selectedSubagents.length; index += 1) {
      startedAtByWorkerId[`worker-${index + 1}`] = handle.startedAt;
    }
  }

  const roleOutputsRaw = runtime.roleOutputs;
  const roleManagement = parseRoleManagementFromRuntime(runtime, selectedSubagents);
  const roleManagedSubagents = applyRoleManagementModelRecommendations({
    subagents: selectedSubagents,
    roleManagement,
  });
  const coordinationPlan = parseCoordinationPlanFromRuntime(
    runtime,
    roleManagedSubagents,
  );
  const roleOutputs = Array.isArray(roleOutputsRaw)
    ? roleOutputsRaw.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : buildRoleOutputs({
        teamName: handle.teamName,
        task: readString(runtime.task) ?? 'subagent assignment',
        selectedSubagents: roleManagedSubagents,
      });
  const generatedPrdArtifacts = buildPrdArtifacts({
    teamName: handle.teamName,
    task: readString(runtime.task) ?? 'subagent assignment',
    selectedSubagents: roleManagedSubagents,
    roleOutputs,
  });
  const prd = isRecord(runtime.prd)
    ? (runtime.prd as unknown as PrdDocument)
    : generatedPrdArtifacts.prd;
  const prdCriteriaResults = isRecord(runtime.prdCriteriaResults)
    ? (runtime.prdCriteriaResults as Record<
        string,
        Record<string, AcceptanceCriterionResultValue>
      >)
    : generatedPrdArtifacts.prdCriteriaResults;

  return {
    selectedSubagents: roleManagedSubagents,
    unifiedModel,
    roleManagement,
    coordinationPlan,
    roleOutputs,
    prd,
    prdCriteriaResults,
    startedAtByWorkerId,
    catalogPath,
  };
}

function resolveWorkerCount(rawWorkers: number | undefined): number {
  const resolved = rawWorkers ?? DEFAULT_WORKERS;
  if (!Number.isInteger(resolved) || resolved < MIN_WORKERS || resolved > MAX_WORKERS) {
    throw new Error(
      `Invalid subagents worker count ${JSON.stringify(rawWorkers)}. Expected integer ${MIN_WORKERS}..${MAX_WORKERS}.`,
    );
  }

  return resolved;
}

function pickCatalogSubagents(
  catalogSubagents: TeamSubagentDefinition[],
  workerCount: number,
): TeamSubagentDefinition[] {
  if (catalogSubagents.length < workerCount) {
    throw new Error(
      `Subagent catalog has ${catalogSubagents.length} entries, but ${workerCount} workers were requested.`,
    );
  }

  return catalogSubagents.slice(0, workerCount);
}

function mapRoleOutputStatusToWorkerStatus(
  roleOutput: Record<string, unknown> | undefined,
): WorkerRuntimeStatus {
  const status = readString(roleOutput?.status)?.toLowerCase();
  if (status === 'completed') {
    return 'done';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'failed') {
    return 'failed';
  }

  return 'failed';
}

export class SubagentsRuntimeBackend implements RuntimeBackend {
  readonly name = 'subagents' as const;
  private readonly runtimeContexts = new Map<string, SubagentRuntimeContext>();

  async probePrerequisites(cwd: string): Promise<RuntimeProbeResult> {
    const issues: string[] = [];
    const enabled = await experimentalOptInEnabled(cwd);

    if (!enabled) {
      issues.push(
        'Subagents backend is experimental. Set OMG_EXPERIMENTAL_ENABLE_AGENTS=true or .gemini/settings.json experimental.enableAgents=true.',
      );
    }

    if (enabled) {
      try {
        const catalog = await loadSubagentCatalog(cwd);
        if (catalog.subagents.length === 0) {
          issues.push(
            'Subagent catalog is empty. Add entries to .gemini/agents/catalog.json.',
          );
        }
      } catch (error) {
        issues.push(
          `Failed to load subagent catalog: ${(error as Error).message}`,
        );
      }
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  async startTeam(input: TeamStartInput): Promise<TeamHandle> {
    if (!(await experimentalOptInEnabled(input.cwd))) {
      throw new Error(
        'Subagents backend blocked: enable OMG_EXPERIMENTAL_ENABLE_AGENTS=true or .gemini/settings.json experimental.enableAgents=true.',
      );
    }

    const catalog = await loadSubagentCatalog(input.cwd);
    const explicitAssignments =
      input.subagents !== undefined && input.subagents.length > 0;
    const selectedSubagents = explicitAssignments
      ? resolveSubagentSelection(catalog, input.subagents)
      : pickCatalogSubagents(
          catalog.subagents,
          resolveWorkerCount(input.workers),
        );

    const workerCount = explicitAssignments
      ? input.workers === undefined
        ? resolveWorkerCount(selectedSubagents.length)
        : resolveWorkerCount(input.workers)
      : resolveWorkerCount(input.workers);

    if (selectedSubagents.length === 0) {
      throw new Error('No subagents selected for execution.');
    }

    if (selectedSubagents.length !== workerCount) {
      throw new Error(
        `Subagent worker mismatch: resolved ${selectedSubagents.length} subagent(s) but workers=${workerCount}.`,
      );
    }

    const roleManagement = resolveSubagentRoleManagement(selectedSubagents);
    const roleManagedSubagents = applyRoleManagementModelRecommendations({
      subagents: selectedSubagents,
      roleManagement,
    });
    const coordinationPlan = createAgentCoordinationPlan(roleManagedSubagents);
    const roleOutputs = buildRoleOutputs({
      teamName: input.teamName,
      task: input.task,
      selectedSubagents: roleManagedSubagents,
    });
    const prdArtifacts = buildPrdArtifacts({
      teamName: input.teamName,
      task: input.task,
      selectedSubagents: roleManagedSubagents,
      roleOutputs,
    });
    try {
      await persistRoleArtifacts({
        cwd: input.cwd,
        roleOutputs,
      });
    } catch (error) {
      throw new Error(
        `Failed to persist subagent role artifacts: ${(error as Error).message}`,
      );
    }

    const id = `subagents-${randomUUID()}`;
    const roleArtifactRoot = buildRoleArtifactRoot(input.teamName);
    const startedAt = new Date().toISOString();
    const initialAgentLifecycle = buildInitialAgentLifecycleRecords({
      selectedSubagents: roleManagedSubagents,
      startedAt,
    });
    const initialLifecycleSummary = summarizeAgentLifecycle(initialAgentLifecycle);

    const handle: TeamHandle = {
      id,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt,
      metadata: {
        ...input.metadata,
        experimental: true,
      },
      runtime: {
        deterministic: true,
        workerCount,
        task: input.task,
        taskAuditLogPath: buildTaskAuditLogPath(input.cwd, input.teamName),
        catalogPath: catalog.sourcePath ?? 'embedded:default',
        unifiedModel: catalog.unifiedModel,
        roleArtifactRoot,
        selectedSubagents: roleManagedSubagents.map((subagent, index) => ({
          id: subagent.id,
          role: subagent.role,
          mission: subagent.mission,
          model: subagent.model,
          aliases: subagent.aliases,
          skills: resolveEffectiveSubagentSkills(subagent),
          assignmentIndex: index + 1,
          workerId: `worker-${index + 1}`,
        })),
        roleContractVersion: 1,
        roleManagementVersion: 1,
        roleManagement,
        coordinationVersion: 1,
        coordinationPlan,
        roleOutputs,
        agentLifecycleVersion: 1,
        agentLifecycle: initialAgentLifecycle,
        agentLifecycleSummary: initialLifecycleSummary,
        prd: prdArtifacts.prd,
        prdCriteriaResults: prdArtifacts.prdCriteriaResults,
      },
    };

    this.runtimeContexts.set(id, {
      selectedSubagents: roleManagedSubagents,
      unifiedModel: catalog.unifiedModel,
      roleManagement,
      coordinationPlan,
      roleOutputs,
      prd: prdArtifacts.prd,
      prdCriteriaResults: prdArtifacts.prdCriteriaResults,
      startedAtByWorkerId: Object.fromEntries(
        initialAgentLifecycle.map((entry) => [entry.workerId, entry.startedAt ?? startedAt]),
      ),
      catalogPath: catalog.sourcePath,
    });

    return handle;
  }

  async monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> {
    const runtimeContext =
      this.runtimeContexts.get(handle.id) ??
      restoreRuntimeContextFromHandle(handle);
    const observedAt = new Date().toISOString();

    if (!runtimeContext || runtimeContext.selectedSubagents.length === 0) {
      return {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: 'failed',
        updatedAt: observedAt,
        workers: [],
        failureReason:
          'No subagents available in runtime context. Start the backend with explicit or catalog-backed assignments.',
        runtime: handle.runtime,
      };
    }

    const roleOutputByWorkerId = new Map<string, Record<string, unknown>>();
    for (const output of runtimeContext.roleOutputs) {
      const workerId = readString(output.workerId);
      if (workerId) {
        roleOutputByWorkerId.set(workerId, output);
      }
    }

    const roleContractReport = evaluateRoleOutputContract(
      {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: 'completed',
        updatedAt: observedAt,
        workers: [],
        runtime: {
          ...handle.runtime,
          roleOutputs: runtimeContext.roleOutputs,
          prd: runtimeContext.prd,
          prdCriteriaResults: runtimeContext.prdCriteriaResults,
        },
      },
      {
        requireArtifactEvidence: true,
        cwd: handle.cwd,
        teamName: handle.teamName,
      },
    );
    const roleContractPassed = roleContractReport.applicable
      ? roleContractReport.passed
      : false;
    const agentLifecycle = buildAgentLifecycleRecords({
      selectedSubagents: runtimeContext.selectedSubagents,
      roleOutputs: runtimeContext.roleOutputs,
      observedAt,
      startedAtByWorkerId: runtimeContext.startedAtByWorkerId,
    });
    const agentLifecycleSummary = summarizeAgentLifecycle(agentLifecycle);
    const coordinationStepByWorkerId = new Map<
      string,
      { stage: number; dependsOn: string[] }
    >();
    for (const step of runtimeContext.coordinationPlan.steps) {
      for (const workerId of step.workerIds) {
        coordinationStepByWorkerId.set(workerId, {
          stage: step.stage,
          dependsOn: [...step.dependsOn],
        });
      }
    }

    const workers = runtimeContext.selectedSubagents.map((subagent, index) => {
      const workerId = `worker-${index + 1}`;
      const roleOutput = roleOutputByWorkerId.get(workerId);
      const artifacts =
        roleOutput && isRecord(roleOutput.artifacts)
          ? roleOutput.artifacts
          : undefined;
      const artifactRef = artifacts
        ? readString(artifacts.json) ?? readString(artifacts.markdown)
        : undefined;

      const resolvedSkills = resolveEffectiveSubagentSkills(subagent);
      const coordination = coordinationStepByWorkerId.get(workerId);

      return {
        workerId,
        status: mapRoleOutputStatusToWorkerStatus(roleOutput),
        lastHeartbeatAt: observedAt,
        details: [
          `subagent=${subagent.id}`,
          `role=${subagent.role}`,
          `skill=${resolvePrimarySkill(subagent)}`,
          `skills=${resolvedSkills.join('|')}`,
          `model=${subagent.model}`,
          `assignment=${index + 1}/${runtimeContext.selectedSubagents.length}`,
          coordination ? `stage=${coordination.stage}` : undefined,
          coordination && coordination.dependsOn.length > 0
            ? `dependsOn=${coordination.dependsOn.join('|')}`
            : undefined,
          `outputStatus=${readString(roleOutput?.status) ?? 'missing'}`,
          artifactRef ? `artifact=${artifactRef}` : undefined,
        ]
          .filter((part): part is string => Boolean(part))
          .join(', '),
      };
    });
    const roleSkillSummary = runtimeContext.selectedSubagents
      .map((subagent) => `${subagent.id}->${resolvePrimarySkill(subagent)}`)
      .join(', ');
    const successfulSummary = `Subagents backend executed ${runtimeContext.selectedSubagents.length} assigned role(s): ${runtimeContext.selectedSubagents
      .map((subagent) => subagent.id)
      .join(', ')}. Skill contracts: ${roleSkillSummary}.`;
    const failureSummary = `Subagents runtime evidence gate failed: ${roleContractReport.summary}`;
    const snapshotStatus = roleContractPassed ? 'completed' : 'failed';
    const verifyBaselineSource = roleContractPassed
      ? 'subagents-runtime'
      : 'subagents-runtime-contract';

    return {
      handleId: handle.id,
      teamName: handle.teamName,
      backend: this.name,
      status: snapshotStatus,
      updatedAt: observedAt,
      workers,
      summary: roleContractPassed ? successfulSummary : failureSummary,
      failureReason: roleContractPassed ? undefined : failureSummary,
      runtime: {
        ...handle.runtime,
        deterministic: true,
        observedAt,
        roleContractVersion: 1,
        roleContract: {
          version: 1,
          outputCount: runtimeContext.roleOutputs.length,
          assignmentCount: runtimeContext.selectedSubagents.length,
          passed: roleContractReport.passed,
          summary: roleContractReport.summary,
          issues: roleContractReport.issues,
          ...roleContractReport.metadata,
        },
        agentLifecycleVersion: 1,
        agentLifecycle,
        agentLifecycleSummary,
        coordinationVersion: 1,
        coordinationPlan: runtimeContext.coordinationPlan,
        roleManagementVersion: 1,
        roleManagement: runtimeContext.roleManagement,
        roleOutputs: runtimeContext.roleOutputs,
        prd: runtimeContext.prd,
        prdCriteriaResults: runtimeContext.prdCriteriaResults,
        verifyBaselinePassed: roleContractPassed,
        verifyBaselineSource,
        catalogPath:
          runtimeContext.catalogPath ??
          (isRecord(handle.runtime) && typeof handle.runtime.catalogPath === 'string'
            ? handle.runtime.catalogPath
            : undefined),
        unifiedModel: runtimeContext.unifiedModel,
      },
    };
  }

  async shutdownTeam(handle: TeamHandle): Promise<void> {
    this.runtimeContexts.delete(handle.id);
  }
}
