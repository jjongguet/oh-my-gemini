import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_WORKERS,
  MAX_WORKERS,
  MIN_WORKERS,
} from '../../constants.js';
import {
  TeamStateStore,
  type PersistedWorkerDoneSignal,
  type PersistedWorkerHeartbeat,
  type PersistedWorkerIdentity,
  type PersistedWorkerStatus,
} from '../../state/index.js';
import { buildRuntimeEnvironment } from '../../platform/index.js';
import {
  loadSubagentCatalog,
  resolveSubagentSelection,
} from '../subagents-catalog.js';
import { evaluateRoleOutputContract } from '../role-output-contract.js';
import { inferCanonicalSkillsForRole } from '../role-skill-mapping.js';
import type {
  TeamHandle,
  TeamSnapshot,
  TeamStartInput,
  TeamSubagentDefinition,
  WorkerRuntimeStatus,
  WorkerSnapshot,
} from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';
import { runCommand } from './process-utils.js';

type SignalForwardingMode = 'wrapper-forward';

interface SelectedSubagentAssignment {
  id: string;
  role: string;
  mission: string;
  model: string;
  aliases?: string[];
  skills: string[];
  workerId: string;
  assignmentIndex: number;
}

interface WorkerProcessRuntimeMetadata {
  wrapperPid?: number;
  childPid?: number;
  signalForwardingMode: SignalForwardingMode;
  subagentId: string;
  roleId: string;
  wrapperAlive?: boolean;
  childAlive?: boolean;
}

interface SpawnWorkerContext {
  child: ChildProcess;
  stdoutTail: string;
  stderrTail: string;
  exitCode?: number | null;
  error?: string;
}

interface GeminiSpawnRuntimeContext {
  stateRoot: string;
  selectedAssignments: SelectedSubagentAssignment[];
  workerProcesses: Record<string, WorkerProcessRuntimeMetadata>;
  spawnedWorkers: Map<string, SpawnWorkerContext>;
  catalogPath?: string;
  unifiedModel?: string;
}

interface GeminiSpawnBackendOptions {
  spawnProcess?: typeof spawn;
  commandRunner?: typeof runCommand;
}

const OUTPUT_TAIL_MAX_CHARS = 4_000;
const SHUTDOWN_GRACE_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => entry !== undefined);
}

function appendTail(current: string, chunk: string, maxChars = OUTPUT_TAIL_MAX_CHARS): string {
  const next = `${current}${chunk}`;
  if (next.length <= maxChars) {
    return next;
  }

  return next.slice(next.length - maxChars);
}

function sanitizeArtifactSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildRoleArtifactRoot(teamName: string): string {
  const team = sanitizeArtifactSegment(teamName) || 'team';
  return path.posix.join(
    '.omp',
    'state',
    'team',
    team,
    'artifacts',
    'roles',
  );
}

function buildRoleArtifactBase(
  teamName: string,
  workerId: string,
  subagentId: string,
): string {
  const worker = sanitizeArtifactSegment(workerId) || 'worker';
  const role = sanitizeArtifactSegment(subagentId) || 'role';
  return path.posix.join(buildRoleArtifactRoot(teamName), worker, role);
}

function resolveStateRoot(cwd: string, env: Record<string, string> | undefined): string {
  return (
    env?.OMP_TEAM_STATE_ROOT ??
    env?.OMX_TEAM_STATE_ROOT ??
    path.join(cwd, '.omp', 'state')
  );
}

function buildTaskAuditLogPath(stateRoot: string, teamName: string): string {
  return path.join(stateRoot, 'team', teamName, 'events', 'task-lifecycle.ndjson');
}

function resolveCliEntryPath(): string {
  return fileURLToPath(new URL('../../../dist/cli/index.js', import.meta.url));
}

function resolveWorkerCount(rawWorkers: number | undefined): number {
  const resolved = rawWorkers ?? DEFAULT_WORKERS;
  if (!Number.isInteger(resolved) || resolved < MIN_WORKERS || resolved > MAX_WORKERS) {
    throw new Error(
      `Invalid gemini-spawn worker count ${JSON.stringify(rawWorkers)}. Expected integer ${MIN_WORKERS}..${MAX_WORKERS}.`,
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

function resolveEffectiveSkills(subagent: TeamSubagentDefinition): string[] {
  if (Array.isArray(subagent.skills) && subagent.skills.length > 0) {
    return [...subagent.skills];
  }

  return inferCanonicalSkillsForRole({
    roleId: subagent.id,
    aliases: [subagent.role, ...(subagent.aliases ?? [])],
  });
}

function toSelectedAssignments(
  subagents: TeamSubagentDefinition[],
): SelectedSubagentAssignment[] {
  return subagents.map((subagent, index) => ({
    id: subagent.id,
    role: subagent.role,
    mission: subagent.mission,
    model: subagent.model,
    aliases: subagent.aliases,
    skills: resolveEffectiveSkills(subagent),
    workerId: `worker-${index + 1}`,
    assignmentIndex: index + 1,
  }));
}

function parseSelectedAssignmentsFromRuntime(
  runtime: Record<string, unknown>,
): SelectedSubagentAssignment[] {
  const selectedRaw = runtime.selectedSubagents;
  if (!Array.isArray(selectedRaw)) {
    return [];
  }

  const selectedAssignments: SelectedSubagentAssignment[] = [];

  selectedRaw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      return;
    }

    const id = readString(entry.id);
    if (!id) {
      return;
    }

    selectedAssignments.push({
      id,
      role: readString(entry.role) ?? id,
      mission:
        readString(entry.mission) ??
        `Execute ${readString(entry.role) ?? id} responsibilities for the active team task.`,
      model: readString(entry.model) ?? 'gemini',
      aliases: readStringArray(entry.aliases),
      skills: readStringArray(entry.skills),
      workerId: readString(entry.workerId) ?? `worker-${index + 1}`,
      assignmentIndex:
        typeof entry.assignmentIndex === 'number' && Number.isInteger(entry.assignmentIndex)
          ? entry.assignmentIndex
          : index + 1,
    });
  });

  return selectedAssignments;
}

function parseWorkerProcessesFromRuntime(
  runtime: Record<string, unknown>,
): Record<string, WorkerProcessRuntimeMetadata> {
  const processesRaw = runtime.workerProcesses;
  if (!isRecord(processesRaw)) {
    return {};
  }

  const parsed: Record<string, WorkerProcessRuntimeMetadata> = {};
  for (const [workerId, value] of Object.entries(processesRaw)) {
    if (!isRecord(value)) {
      continue;
    }

    const wrapperPid =
      typeof value.wrapperPid === 'number' && Number.isInteger(value.wrapperPid)
        ? value.wrapperPid
        : undefined;
    const childPid =
      typeof value.childPid === 'number' && Number.isInteger(value.childPid)
        ? value.childPid
        : undefined;
    if (wrapperPid === undefined && childPid === undefined) {
      continue;
    }

    parsed[workerId] = {
      wrapperPid,
      childPid,
      signalForwardingMode: 'wrapper-forward',
      subagentId: readString(value.subagentId) ?? workerId,
      roleId: readString(value.roleId) ?? workerId,
      wrapperAlive:
        typeof value.wrapperAlive === 'boolean' ? value.wrapperAlive : undefined,
      childAlive:
        typeof value.childAlive === 'boolean' ? value.childAlive : undefined,
    };
  }

  return parsed;
}

function buildWorkerCommandArgs(teamName: string, workerId: string): string[] {
  return [resolveCliEntryPath(), 'worker', 'run', '--team', teamName, '--worker', workerId];
}

function isPidAlive(pid: number | undefined): boolean {
  if (!pid || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWorkerDetails(params: {
  assignment: SelectedSubagentAssignment | undefined;
  heartbeat?: PersistedWorkerHeartbeat;
  status?: PersistedWorkerStatus;
  doneSignal?: PersistedWorkerDoneSignal;
  processMeta?: WorkerProcessRuntimeMetadata;
}): string | undefined {
  const parts: string[] = [];

  if (params.assignment) {
    parts.push(`role=${params.assignment.role}`);
    if (params.assignment.skills[0]) {
      parts.push(`skill=${params.assignment.skills[0]}`);
    }
  }

  if (typeof params.processMeta?.wrapperPid === 'number') {
    parts.push(`wrapperPid=${params.processMeta.wrapperPid}`);
  }

  if (typeof params.processMeta?.childPid === 'number') {
    parts.push(`childPid=${params.processMeta.childPid}`);
  }

  if (params.status?.reason) {
    parts.push(`reason=${params.status.reason}`);
  }

  if (params.doneSignal?.summary) {
    parts.push(`done=${params.doneSignal.status}`);
    parts.push(`summary=${params.doneSignal.summary}`);
  }

  return parts.length > 0 ? parts.join(' | ') : undefined;
}

async function readRoleOutputFromArtifacts(
  cwd: string,
  artifactBase: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!artifactBase) {
    return null;
  }

  const jsonPath = path.isAbsolute(artifactBase)
    ? `${artifactBase}.json`
    : path.join(cwd, `${artifactBase}.json`);

  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readRoleOutputForWorker(params: {
  cwd: string;
  doneSignal?: PersistedWorkerDoneSignal;
  identity?: PersistedWorkerIdentity;
}): Promise<Record<string, unknown> | null> {
  const doneMetadata = isRecord(params.doneSignal?.metadata) ? params.doneSignal?.metadata : undefined;
  if (doneMetadata && isRecord(doneMetadata.roleOutput)) {
    return doneMetadata.roleOutput;
  }

  const identityMetadata = isRecord(params.identity?.metadata) ? params.identity.metadata : undefined;
  const artifactBase =
    readString(doneMetadata?.roleArtifactBase) ??
    readString(identityMetadata?.roleArtifactBase);

  return readRoleOutputFromArtifacts(params.cwd, artifactBase);
}

async function writeWorkerIdentityForAssignment(params: {
  stateStore: TeamStateStore;
  teamName: string;
  stateRoot: string;
  assignment: SelectedSubagentAssignment;
}): Promise<void> {
  const { stateStore, teamName, stateRoot, assignment } = params;
  const roleArtifactBase = buildRoleArtifactBase(
    teamName,
    assignment.workerId,
    assignment.id,
  );

  await stateStore.writeWorkerIdentity({
    teamName,
    workerName: assignment.workerId,
    role: assignment.role,
    index: assignment.assignmentIndex,
    teamStateRoot: stateRoot,
    updatedAt: new Date().toISOString(),
    metadata: {
      subagentId: assignment.id,
      skills: assignment.skills,
      primarySkill: assignment.skills[0] ?? 'team',
      roleArtifactBase,
      roleArtifactRoot: buildRoleArtifactRoot(teamName),
      signalForwardingMode: 'wrapper-forward',
      model: assignment.model,
      mission: assignment.mission,
    },
  });
}

async function readWorkerProcessesFromState(params: {
  stateStore: TeamStateStore;
  teamName: string;
}): Promise<Record<string, WorkerProcessRuntimeMetadata>> {
  const [identities, doneSignals] = await Promise.all([
    params.stateStore.readAllWorkerIdentities(params.teamName).catch(
      (): Record<string, PersistedWorkerIdentity> => ({}),
    ),
    params.stateStore.readAllWorkerDoneSignals(params.teamName).catch(
      (): Record<string, PersistedWorkerDoneSignal> => ({}),
    ),
  ]);

  const workerProcesses: Record<string, WorkerProcessRuntimeMetadata> = {};
  const workerIds = new Set([
    ...Object.keys(identities),
    ...Object.keys(doneSignals),
  ]);

  for (const workerId of workerIds) {
    const identity = identities[workerId];
    const identityMetadata = isRecord(identity?.metadata) ? identity.metadata : undefined;
    const doneMetadata = isRecord(doneSignals[workerId]?.metadata)
      ? doneSignals[workerId]?.metadata
      : undefined;
    const wrapperPid =
      (typeof identityMetadata?.wrapperPid === 'number' ? identityMetadata.wrapperPid : undefined) ??
      (typeof doneMetadata?.wrapperPid === 'number' ? doneMetadata.wrapperPid : undefined);
    const childPid =
      (typeof identityMetadata?.childPid === 'number' ? identityMetadata.childPid : undefined) ??
      (typeof doneMetadata?.childPid === 'number' ? doneMetadata.childPid : undefined);

    if (wrapperPid === undefined && childPid === undefined) {
      continue;
    }

    workerProcesses[workerId] = {
      wrapperPid,
      childPid,
      signalForwardingMode: 'wrapper-forward',
      subagentId:
        readString(identityMetadata?.subagentId) ??
        workerId,
      roleId:
        identity?.role ??
        workerId,
    };
  }

  return workerProcesses;
}

export class GeminiSpawnBackend implements RuntimeBackend {
  readonly name = 'gemini-spawn' as const;

  private readonly spawnProcess: typeof spawn;
  private readonly commandRunner: typeof runCommand;
  private readonly runtimeContexts = new Map<string, GeminiSpawnRuntimeContext>();

  constructor(options: GeminiSpawnBackendOptions = {}) {
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.commandRunner = options.commandRunner ?? runCommand;
  }

  async probePrerequisites(cwd: string): Promise<RuntimeProbeResult> {
    const issues: string[] = [];

    try {
      const result = await this.commandRunner('gemini', ['--version'], {
        cwd,
        timeoutMs: 5_000,
      });
      if (!result.stdout && !result.stderr) {
        issues.push('Gemini CLI did not report a version string.');
      }
    } catch (error) {
      issues.push(
        `Gemini CLI is unavailable: ${(error as Error).message}`,
      );
    }

    try {
      const catalog = await loadSubagentCatalog(cwd);
      if (catalog.subagents.length === 0) {
        issues.push('Subagent catalog is empty. Add entries to .gemini/agents/catalog.json.');
      }
    } catch (error) {
      issues.push(
        `Failed to load subagent catalog: ${(error as Error).message}`,
      );
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  async startTeam(input: TeamStartInput): Promise<TeamHandle> {
    const catalog = await loadSubagentCatalog(input.cwd);
    const explicitAssignments =
      input.subagents !== undefined && input.subagents.length > 0;
    const selectedSubagents = explicitAssignments
      ? resolveSubagentSelection(catalog, input.subagents)
      : pickCatalogSubagents(catalog.subagents, resolveWorkerCount(input.workers));

    const workerCount = explicitAssignments
      ? input.workers === undefined
        ? resolveWorkerCount(selectedSubagents.length)
        : resolveWorkerCount(input.workers)
      : resolveWorkerCount(input.workers);

    if (selectedSubagents.length !== workerCount) {
      throw new Error(
        `Gemini spawn worker mismatch: resolved ${selectedSubagents.length} subagent(s) but workers=${workerCount}.`,
      );
    }

    const selectedAssignments = toSelectedAssignments(selectedSubagents);
    const stateRoot = resolveStateRoot(input.cwd, input.env);
    const stateStore = new TeamStateStore({ rootDir: stateRoot });
    const id = `gemini-spawn-${randomUUID()}`;
    const workerProcesses: Record<string, WorkerProcessRuntimeMetadata> = {};
    const spawnedWorkers = new Map<string, SpawnWorkerContext>();

    await Promise.all(
      selectedAssignments.map((assignment) =>
        writeWorkerIdentityForAssignment({
          stateStore,
          teamName: input.teamName,
          stateRoot,
          assignment,
        }),
      ),
    );

    try {
      for (const assignment of selectedAssignments) {
        const taskClaim = input.taskClaims?.[assignment.workerId];
        const runtimeEnv = buildRuntimeEnvironment({
          overrides: {
            ...(input.env ?? {}),
            OMP_TEAM_WORKER: `${input.teamName}/${assignment.workerId}`,
            OMX_TEAM_WORKER: `${input.teamName}/${assignment.workerId}`,
            OMP_WORKER_NAME: assignment.workerId,
            OMP_TEAM_WORKER_CLI: 'gemini',
            OMX_TEAM_WORKER_CLI: 'gemini',
            OMP_TEAM_STATE_ROOT: stateRoot,
            OMX_TEAM_STATE_ROOT: stateRoot,
            ...(taskClaim
              ? {
                  OMP_WORKER_TASK_ID: taskClaim.taskId,
                  OMP_WORKER_CLAIM_TOKEN: taskClaim.claimToken,
                }
              : {}),
          },
        });

        const child = this.spawnProcess(process.execPath, buildWorkerCommandArgs(
          input.teamName,
          assignment.workerId,
        ), {
          cwd: input.cwd,
          env: runtimeEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const wrapperPid =
          typeof child.pid === 'number' && Number.isInteger(child.pid)
            ? child.pid
            : undefined;
        if (!wrapperPid) {
          throw new Error(`Failed to spawn wrapper process for ${assignment.workerId}.`);
        }

        const spawnedContext: SpawnWorkerContext = {
          child,
          stdoutTail: '',
          stderrTail: '',
        };
        spawnedWorkers.set(assignment.workerId, spawnedContext);

        child.stdout?.on('data', (chunk) => {
          spawnedContext.stdoutTail = appendTail(
            spawnedContext.stdoutTail,
            chunk.toString(),
          );
        });
        child.stderr?.on('data', (chunk) => {
          spawnedContext.stderrTail = appendTail(
            spawnedContext.stderrTail,
            chunk.toString(),
          );
        });
        child.on('exit', (code) => {
          spawnedContext.exitCode = code;
        });
        child.on('error', (error) => {
          spawnedContext.error = error.message;
        });

        workerProcesses[assignment.workerId] = {
          wrapperPid,
          signalForwardingMode: 'wrapper-forward',
          subagentId: assignment.id,
          roleId: assignment.role,
        };
      }
    } catch (error) {
      await this.shutdownWorkerProcesses(workerProcesses, true).catch(() => undefined);
      throw error;
    }

    this.runtimeContexts.set(id, {
      stateRoot,
      selectedAssignments,
      workerProcesses,
      spawnedWorkers,
      catalogPath: catalog.sourcePath,
      unifiedModel: catalog.unifiedModel,
    });

    return {
      id,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      metadata: input.metadata,
      runtime: {
        stateRoot,
        workerCount,
        task: input.task,
        taskAuditLogPath: buildTaskAuditLogPath(stateRoot, input.teamName),
        roleArtifactRoot: buildRoleArtifactRoot(input.teamName),
        selectedSubagents: selectedAssignments.map((assignment) => ({
          id: assignment.id,
          role: assignment.role,
          mission: assignment.mission,
          model: assignment.model,
          aliases: assignment.aliases,
          skills: assignment.skills,
          workerId: assignment.workerId,
          assignmentIndex: assignment.assignmentIndex,
        })),
        workerProcesses,
        verifyBaselinePassed: false,
        verifyBaselineSource: 'gemini-spawn',
        completionProvenance: 'gemini-spawn',
        catalogPath: catalog.sourcePath ?? 'embedded:default',
        unifiedModel: catalog.unifiedModel,
      },
    };
  }

  async monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> {
    const observedAt = new Date().toISOString();
    const runtime = isRecord(handle.runtime) ? handle.runtime : {};
    const runtimeContext = this.runtimeContexts.get(handle.id);
    const selectedAssignments =
      runtimeContext?.selectedAssignments ??
      parseSelectedAssignmentsFromRuntime(runtime);
    const workerProcesses = {
      ...parseWorkerProcessesFromRuntime(runtime),
      ...(runtimeContext?.workerProcesses ?? {}),
    };
    const stateRoot =
      readString(runtime.stateRoot) ??
      runtimeContext?.stateRoot ??
      resolveStateRoot(handle.cwd, undefined);
    const stateStore = new TeamStateStore({ rootDir: stateRoot });
    const roleArtifactRoot =
      readString(runtime.roleArtifactRoot) ?? buildRoleArtifactRoot(handle.teamName);

    if (selectedAssignments.length === 0) {
      return {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: 'failed',
        updatedAt: observedAt,
        workers: [],
        failureReason: 'No selected subagent assignments available for gemini-spawn runtime.',
        runtime: {
          ...runtime,
          verifyBaselinePassed: false,
          verifyBaselineSource: 'gemini-spawn',
          completionProvenance: 'gemini-spawn',
        },
      };
    }

    const [heartbeats, statuses, doneSignals, identities] = await Promise.all([
      stateStore
        .readAllWorkerHeartbeats(handle.teamName)
        .catch((): Record<string, PersistedWorkerHeartbeat> => ({})),
      stateStore
        .readAllWorkerStatuses(handle.teamName)
        .catch((): Record<string, PersistedWorkerStatus> => ({})),
      stateStore
        .readAllWorkerDoneSignals(handle.teamName)
        .catch((): Record<string, PersistedWorkerDoneSignal> => ({})),
      stateStore
        .readAllWorkerIdentities(handle.teamName)
        .catch((): Record<string, PersistedWorkerIdentity> => ({})),
    ]);

    const assignmentByWorkerId = new Map(
      selectedAssignments.map((assignment) => [assignment.workerId, assignment]),
    );
    const workerIds = new Set<string>([
      ...selectedAssignments.map((assignment) => assignment.workerId),
      ...Object.keys(heartbeats),
      ...Object.keys(statuses),
      ...Object.keys(doneSignals),
      ...Object.keys(identities),
      ...Object.keys(workerProcesses),
    ]);

    const runtimeWorkerProcesses: Record<string, WorkerProcessRuntimeMetadata> = {};
    const workers: WorkerSnapshot[] = [];
    const roleOutputs: Record<string, unknown>[] = [];
    const workerFailures: string[] = [];
    const completedEvidenceIssues: string[] = [];

    for (const workerId of [...workerIds].sort((a, b) => a.localeCompare(b))) {
      const assignment = assignmentByWorkerId.get(workerId);
      const heartbeat = heartbeats[workerId];
      const status = statuses[workerId];
      const doneSignal = doneSignals[workerId];
      const identity = identities[workerId];
      const identityMetadata = isRecord(identity?.metadata) ? identity.metadata : undefined;
      const processMeta = workerProcesses[workerId];

      const wrapperPid =
        processMeta?.wrapperPid ??
        (typeof heartbeat?.pid === 'number' ? heartbeat.pid : undefined) ??
        (typeof identityMetadata?.wrapperPid === 'number'
          ? identityMetadata.wrapperPid
          : undefined);
      const childPid =
        processMeta?.childPid ??
        (typeof identityMetadata?.childPid === 'number'
          ? identityMetadata.childPid
          : undefined) ??
        (isRecord(doneSignal?.metadata) && typeof doneSignal.metadata.childPid === 'number'
          ? doneSignal.metadata.childPid
          : undefined);
      const signalForwardingMode = 'wrapper-forward' as const;
      const wrapperAlive = isPidAlive(wrapperPid);
      const childAlive = isPidAlive(childPid);

      runtimeWorkerProcesses[workerId] = {
        wrapperPid,
        childPid,
        signalForwardingMode,
        subagentId:
          readString(identityMetadata?.subagentId) ??
          assignment?.id ??
          processMeta?.subagentId ??
          workerId,
        roleId:
          identity?.role ??
          assignment?.role ??
          processMeta?.roleId ??
          workerId,
        wrapperAlive,
        childAlive,
      };

      let workerStatus: WorkerRuntimeStatus = 'unknown';
      if (doneSignal) {
        workerStatus = doneSignal.status === 'completed' ? 'done' : 'failed';
      } else if (status?.state === 'blocked') {
        workerStatus = 'blocked';
      } else if (status?.state === 'failed' || heartbeat?.alive === false) {
        workerStatus = 'failed';
      } else if (wrapperAlive || childAlive || status?.state === 'in_progress') {
        workerStatus = 'running';
      } else if (wrapperPid || childPid) {
        workerStatus = 'failed';
      }

      const roleOutput = await readRoleOutputForWorker({
        cwd: handle.cwd,
        doneSignal,
        identity,
      });
      if (roleOutput) {
        roleOutputs.push(roleOutput);
      }

      if (
        workerStatus === 'failed' &&
        !doneSignal &&
        (wrapperPid !== undefined || childPid !== undefined)
      ) {
        workerFailures.push(
          `${workerId} exited without a done signal`,
        );
      } else if (doneSignal?.status === 'failed') {
        workerFailures.push(
          `${workerId} failed${doneSignal.error ? `: ${doneSignal.error}` : ''}`,
        );
      } else if (doneSignal?.status === 'completed') {
        const missingEvidence: string[] = [];
        if (!heartbeat) {
          missingEvidence.push('heartbeat');
        }
        if (!status) {
          missingEvidence.push('status');
        }
        if (missingEvidence.length > 0) {
          completedEvidenceIssues.push(
            `${workerId} is missing ${missingEvidence.join('+')} evidence`,
          );
        }
      }

      workers.push({
        workerId,
        status: workerStatus,
        lastHeartbeatAt: heartbeat?.updatedAt ?? doneSignal?.completedAt,
        details: buildWorkerDetails({
          assignment,
          heartbeat,
          status,
          doneSignal,
          processMeta: runtimeWorkerProcesses[workerId],
        }),
      });
    }

    const allWorkersTerminal =
      workers.length > 0 &&
      workers.every((worker) => worker.status === 'done' || worker.status === 'failed');
    const hasFailedWorkers = workers.some((worker) => worker.status === 'failed');
    let status: TeamSnapshot['status'];
    let failureReason: string | undefined;
    let summary: string | undefined;

    const runtimePayload: Record<string, unknown> = {
      ...runtime,
      observedAt,
      stateRoot,
      roleArtifactRoot,
      completionProvenance: 'gemini-spawn',
      selectedSubagents: runtime.selectedSubagents,
      roleOutputs,
      workerProcesses: runtimeWorkerProcesses,
      verifyBaselinePassed: false,
      verifyBaselineSource: 'gemini-spawn',
      catalogPath: runtime.catalogPath ?? runtimeContext?.catalogPath,
      unifiedModel: runtime.unifiedModel ?? runtimeContext?.unifiedModel,
    };

    if (!allWorkersTerminal) {
      status = hasFailedWorkers ? 'failed' : 'running';
      failureReason =
        hasFailedWorkers && workerFailures.length > 0
          ? workerFailures.join(' | ')
          : undefined;
      summary =
        status === 'running'
          ? `gemini-spawn runtime is active with ${workers.length} worker(s).`
          : failureReason;
    } else if (hasFailedWorkers) {
      status = 'failed';
      failureReason = workerFailures.join(' | ') || 'One or more gemini-spawn workers failed.';
      summary = failureReason;
    } else if (completedEvidenceIssues.length > 0) {
      status = 'failed';
      failureReason = `gemini-spawn worker evidence incomplete: ${completedEvidenceIssues.join(' | ')}`;
      summary = failureReason;
      runtimePayload.workerEvidenceContract = {
        passed: false,
        issues: completedEvidenceIssues,
      };
    } else {
      const provisionalSnapshot: TeamSnapshot = {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: 'completed',
        updatedAt: observedAt,
        workers,
        runtime: runtimePayload,
      };
      const roleContractReport = evaluateRoleOutputContract(provisionalSnapshot, {
        requireArtifactEvidence: true,
        cwd: handle.cwd,
        teamName: handle.teamName,
      });

      runtimePayload.roleContract = {
        passed: roleContractReport.passed,
        summary: roleContractReport.summary,
        issues: roleContractReport.issues,
        ...roleContractReport.metadata,
      };
      runtimePayload.workerEvidenceContract = {
        passed: true,
        issues: [],
      };

      if (roleContractReport.passed) {
        status = 'completed';
        runtimePayload.verifyBaselinePassed = true;
        summary = `gemini-spawn runtime completed ${workers.length}/${workers.length} worker assignment(s).`;
      } else {
        status = 'failed';
        failureReason = roleContractReport.summary;
        summary = roleContractReport.summary;
      }
    }

    return {
      handleId: handle.id,
      teamName: handle.teamName,
      backend: this.name,
      status,
      updatedAt: observedAt,
      workers,
      summary,
      failureReason,
      runtime: runtimePayload,
    };
  }

  async shutdownTeam(
    handle: TeamHandle,
    opts: { force?: boolean } = {},
  ): Promise<void> {
    const runtime = isRecord(handle.runtime) ? handle.runtime : {};
    const stateRoot =
      readString(runtime.stateRoot) ??
      this.runtimeContexts.get(handle.id)?.stateRoot ??
      resolveStateRoot(handle.cwd, undefined);
    const stateStore = new TeamStateStore({ rootDir: stateRoot });
    const workerProcesses = {
      ...(await readWorkerProcessesFromState({
        stateStore,
        teamName: handle.teamName,
      }).catch(() => ({}))),
      ...parseWorkerProcessesFromRuntime(runtime),
      ...(this.runtimeContexts.get(handle.id)?.workerProcesses ?? {}),
    };

    try {
      await this.shutdownWorkerProcesses(workerProcesses, opts.force === true);
    } finally {
      this.runtimeContexts.delete(handle.id);
    }
  }

  private async shutdownWorkerProcesses(
    workerProcesses: Record<string, WorkerProcessRuntimeMetadata>,
    force: boolean,
  ): Promise<void> {
    const workerEntries = Object.values(workerProcesses);
    if (workerEntries.length === 0) {
      return;
    }

    const errors: string[] = [];

    for (const worker of workerEntries) {
      try {
        if (worker.wrapperPid !== undefined && isPidAlive(worker.wrapperPid)) {
          process.kill(worker.wrapperPid, 'SIGTERM');
        } else if (isPidAlive(worker.childPid)) {
          process.kill(worker.childPid!, 'SIGTERM');
        }
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    await sleep(SHUTDOWN_GRACE_MS);

    for (const worker of workerEntries) {
      try {
        if (isPidAlive(worker.childPid)) {
          process.kill(worker.childPid!, 'SIGKILL');
        }
        if (worker.wrapperPid !== undefined && isPidAlive(worker.wrapperPid)) {
          process.kill(worker.wrapperPid, 'SIGKILL');
        }
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    if (errors.length > 0 && !force) {
      throw new Error(errors.join(' | '));
    }
  }
}
