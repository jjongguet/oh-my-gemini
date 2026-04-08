import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { readTeamContext } from '../../hooks/index.js';
import { processSubagentStart, processSubagentStop } from '../../hooks/subagent-tracker/index.js';
import { validatePayload } from '../../lib/payload-limits.js';
import { TeamStateStore } from '../../state/index.js';
import type { PersistedWorkerIdentity } from '../../state/index.js';
import { TaskControlPlane } from '../../team/control-plane/index.js';
import { buildHeartbeatSignal } from '../../team/worker-signals.js';
import type { CliIo } from '../types.js';
import { findUnknownOptions, getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface WorkerRunCommandContext {
  cwd: string;
  io: CliIo;
  runGeminiPromptFn?: (input: {
    prompt: string;
    cwd: string;
    env: NodeJS.ProcessEnv;
    onSpawn?: (child: ChildProcess) => void;
  }) => Promise<void | string | { stdout?: string; childPid?: number }>;
}

const GEMINI_PROMPT_MAX_CHARS = 12_000;

type WorkerCliMode = 'omp' | 'gemini';
type WorkerSkillId = 'plan' | 'team' | 'review' | 'verify' | 'handoff';
type SignalForwardingMode = 'wrapper-forward';

interface WorkerExecutionContract {
  workerId: string;
  roleId: string;
  subagentId: string;
  skills: WorkerSkillId[];
  primarySkill: WorkerSkillId;
  roleArtifactBase: string;
  roleArtifactRoot: string;
  signalForwardingMode: SignalForwardingMode;
}

interface ParsedGeminiPromptResult {
  stdout: string;
  childPid?: number;
}

function resolveWorkerCliMode(env: NodeJS.ProcessEnv): WorkerCliMode {
  const raw = (env.OMP_TEAM_WORKER_CLI ?? env.OMX_TEAM_WORKER_CLI ?? 'omp').trim().toLowerCase();
  return raw === 'gemini' ? 'gemini' : 'omp';
}

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

function truncatePromptContext(content: string | null, contextPath: string): string {
  if (!content) {
    return `No team context file was found at ${contextPath}.`;
  }

  const validation = validatePayload(
    { content },
    { maxPayloadBytes: 24_000, maxTopLevelKeys: 4 },
  );

  if (validation.valid && content.length <= GEMINI_PROMPT_MAX_CHARS) {
    return content;
  }

  const truncated = content.slice(0, GEMINI_PROMPT_MAX_CHARS);
  return [
    truncated,
    '',
    `[truncated] Team context exceeded prompt budget; full context remains available at ${contextPath}.`,
  ].join('\n');
}

function buildGeminiWorkerPrompt(input: {
  teamName: string;
  workerName: string;
  taskId?: string;
  contextPath: string;
  contextContent: string | null;
  executionContract?: WorkerExecutionContract | null;
}): string {
  const safeContext = truncatePromptContext(input.contextContent, input.contextPath);
  const contractLines =
    input.executionContract
      ? [
          '',
          '## Completion Contract',
          `- Assigned role: ${input.executionContract.roleId}`,
          `- Assigned subagent: ${input.executionContract.subagentId}`,
          `- Primary skill: ${input.executionContract.primarySkill}`,
          '- When you finish, respond with ONLY a single JSON object that matches this schema exactly.',
          '- Do not wrap the JSON in markdown fences.',
          '',
          '### Required JSON shape',
          '```json',
          JSON.stringify(
            buildRoleOutputSchemaExample(input.executionContract.primarySkill),
            null,
            2,
          ),
          '```',
          '',
          'Make the summary truthful and include only commands/checks you actually performed.',
        ]
      : [];

  return [
    `You are oh-my-product worker ${input.workerName} for team ${input.teamName}.`,
    input.taskId ? `Pre-assigned task id: ${input.taskId}` : 'No explicit pre-assigned task id was provided.',
    'Follow the team context below, perform the assigned worker work, and then exit cleanly.',
    `Team context path: ${input.contextPath}`,
    ...contractLines,
    '',
    '## Team Context',
    safeContext,
  ].join('\n');
}

function buildRoleOutputSchemaExample(
  primarySkill: WorkerSkillId,
): Record<string, unknown> {
  switch (primarySkill) {
    case 'plan':
      return {
        summary: 'Planned the implementation approach.',
        plan: {
          objective: 'Complete the assigned planning task.',
          steps: [
            'Inspect the relevant code paths.',
            'Define implementation steps.',
            'List concrete verification steps.',
          ],
        },
      };
    case 'review':
      return {
        summary: 'Reviewed the requested changes.',
        review: {
          findings: [
            'Finding 1',
          ],
        },
      };
    case 'verify':
      return {
        summary: 'Verified the requested behavior.',
        verification: [
          {
            name: 'typecheck',
            command: 'npm run typecheck',
            result: 'PASS',
          },
        ],
      };
    case 'handoff':
      return {
        summary: 'Prepared the requested handoff.',
        handoff: {
          notes: 'Summarize what was completed and any follow-ups.',
        },
      };
    case 'team':
    default:
      return {
        summary: 'Implemented the requested changes.',
        implementation: {
          changeSummary: 'Describe what changed.',
          commands: ['npm run typecheck'],
        },
      };
  }
}

async function defaultRunGeminiPrompt(input: {
  prompt: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  onSpawn?: (child: ChildProcess) => void;
}): Promise<ParsedGeminiPromptResult> {
  return new Promise<ParsedGeminiPromptResult>((resolve, reject) => {
    const child = spawn('gemini', ['-p', input.prompt], {
      cwd: input.cwd,
      env: input.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    input.onSpawn?.(child);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          childPid:
            typeof child.pid === 'number' && Number.isInteger(child.pid)
              ? child.pid
              : undefined,
        });
        return;
      }

      reject(
        new Error(
          `gemini -p exited ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`,
        ),
      );
    });
  });
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
  return path.posix.join('.omp', 'state', 'team', team, 'artifacts', 'roles');
}

function buildDefaultRoleArtifactBase(
  teamName: string,
  workerName: string,
): string {
  return path.posix.join(
    buildRoleArtifactRoot(teamName),
    sanitizeArtifactSegment(workerName) || 'worker',
    sanitizeArtifactSegment(workerName) || 'role',
  );
}

function normalizeWorkerSkill(value: string | undefined): WorkerSkillId {
  switch (value) {
    case 'plan':
    case 'review':
    case 'verify':
    case 'handoff':
      return value;
    case 'team':
    default:
      return 'team';
  }
}

function parseWorkerExecutionContract(
  teamName: string,
  workerName: string,
  identity: PersistedWorkerIdentity | null,
): WorkerExecutionContract | null {
  if (!identity || !isRecord(identity.metadata)) {
    return null;
  }

  const metadata = identity.metadata;
  const subagentId = readString(metadata.subagentId);
  if (!subagentId) {
    return null;
  }

  const skills = readStringArray(metadata.skills)
    .map((entry) => normalizeWorkerSkill(entry))
    .filter((entry, index, list) => list.indexOf(entry) === index);
  const primarySkill = normalizeWorkerSkill(
    readString(metadata.primarySkill) ?? skills[0],
  );
  const roleArtifactBase =
    readString(metadata.roleArtifactBase) ??
    buildDefaultRoleArtifactBase(teamName, workerName);

  return {
    workerId: workerName,
    roleId: identity.role ?? workerName,
    subagentId,
    skills: skills.length > 0 ? skills : [primarySkill],
    primarySkill,
    roleArtifactBase,
    roleArtifactRoot:
      readString(metadata.roleArtifactRoot) ?? buildRoleArtifactRoot(teamName),
    signalForwardingMode: 'wrapper-forward',
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Gemini returned empty output.');
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim();
    if (fenced.startsWith('{') && fenced.endsWith('}')) {
      return fenced;
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('Gemini output did not contain a JSON object.');
}

function parseVerificationEntries(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Verifier output is missing verification entries.');
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Verifier output entry ${index} is invalid.`);
    }

    const name = readString(entry.name);
    const command = readString(entry.command);
    const result = readString(entry.result)?.toUpperCase();
    if (!name || !command || !result) {
      throw new Error(`Verifier output entry ${index} is missing required fields.`);
    }
    if (result !== 'PASS') {
      throw new Error(`Verifier output entry ${index} must report PASS.`);
    }

    return { name, command, result };
  });
}

function parseGeminiRoleOutput(
  rawOutput: string,
  contract: WorkerExecutionContract,
): Record<string, unknown> {
  const parsed = JSON.parse(extractJsonObject(rawOutput));
  if (!isRecord(parsed)) {
    throw new Error('Gemini output was not a JSON object.');
  }

  const summary = readString(parsed.summary);
  if (!summary) {
    throw new Error('Gemini output is missing summary.');
  }

  const roleOutput: Record<string, unknown> = {
    subagentId: contract.subagentId,
    roleId: contract.roleId,
    workerId: contract.workerId,
    skill: contract.primarySkill,
    skills: contract.skills,
    status: 'completed',
    summary,
    completionProvenance: 'gemini-spawn',
    artifacts: {
      json: `${contract.roleArtifactBase}.json`,
      markdown: `${contract.roleArtifactBase}.md`,
    },
  };

  switch (contract.primarySkill) {
    case 'plan': {
      const plan = parsed.plan;
      if (!isRecord(plan)) {
        throw new Error('Planner output is missing plan object.');
      }
      const steps = readStringArray(plan.steps);
      if (steps.length === 0) {
        throw new Error('Planner output is missing plan.steps.');
      }
      roleOutput.plan = {
        objective: readString(plan.objective) ?? summary,
        steps,
      };
      break;
    }
    case 'review': {
      const review = parsed.review;
      if (!isRecord(review)) {
        throw new Error('Review output is missing review object.');
      }
      const findings = readStringArray(review.findings);
      if (findings.length === 0) {
        throw new Error('Review output is missing review.findings.');
      }
      roleOutput.review = { findings };
      break;
    }
    case 'verify':
      roleOutput.verification = parseVerificationEntries(parsed.verification);
      break;
    case 'handoff': {
      const handoff = parsed.handoff;
      if (!isRecord(handoff) || !readString(handoff.notes)) {
        throw new Error('Handoff output is missing handoff.notes.');
      }
      roleOutput.handoff = {
        notes: readString(handoff.notes),
      };
      break;
    }
    case 'team':
    default: {
      const implementation = parsed.implementation;
      if (!isRecord(implementation)) {
        throw new Error('Executor output is missing implementation object.');
      }
      const changeSummary = readString(implementation.changeSummary);
      const commands = readStringArray(implementation.commands);
      if (!changeSummary || commands.length === 0) {
        throw new Error(
          'Executor output requires implementation.changeSummary and implementation.commands[].',
        );
      }
      roleOutput.implementation = {
        changeSummary,
        commands,
      };
      break;
    }
  }

  return roleOutput;
}

function renderRoleOutputMarkdown(roleOutput: Record<string, unknown>): string {
  const roleId = readString(roleOutput.roleId) ?? readString(roleOutput.subagentId) ?? 'role';
  const workerId = readString(roleOutput.workerId) ?? 'worker';
  const status = readString(roleOutput.status) ?? 'completed';
  const summary = readString(roleOutput.summary);

  return [
    `# Role Output: ${roleId}`,
    '',
    `- worker: ${workerId}`,
    `- status: ${status}`,
    ...(summary ? [`- summary: ${summary}`] : []),
    '',
    '```json',
    JSON.stringify(roleOutput, null, 2),
    '```',
    '',
  ].join('\n');
}

async function persistRoleOutputArtifacts(
  cwd: string,
  roleOutput: Record<string, unknown>,
): Promise<void> {
  const artifacts = isRecord(roleOutput.artifacts) ? roleOutput.artifacts : undefined;
  const jsonRef = readString(artifacts?.json);
  const markdownRef = readString(artifacts?.markdown);

  if (!jsonRef || !markdownRef) {
    throw new Error('Role output artifacts are missing json/markdown refs.');
  }

  const targets = [
    {
      ref: jsonRef,
      content: `${JSON.stringify(roleOutput, null, 2)}\n`,
    },
    {
      ref: markdownRef,
      content: renderRoleOutputMarkdown(roleOutput),
    },
  ];

  await Promise.all(
    targets.map(async (target) => {
      const filePath = path.isAbsolute(target.ref) ? target.ref : path.join(cwd, target.ref);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, target.content, 'utf8');
    }),
  );
}

async function updateWorkerIdentityMetadata(params: {
  stateStore: TeamStateStore;
  teamName: string;
  workerName: string;
  identity: PersistedWorkerIdentity | null;
  metadata: Record<string, unknown>;
}): Promise<PersistedWorkerIdentity | null> {
  const baseIdentity =
    params.identity ??
    {
      teamName: params.teamName,
      workerName: params.workerName,
      updatedAt: new Date().toISOString(),
    };

  const nextIdentity: PersistedWorkerIdentity = {
    ...baseIdentity,
    teamName: params.teamName,
    workerName: params.workerName,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(isRecord(baseIdentity.metadata) ? baseIdentity.metadata : {}),
      ...params.metadata,
    },
  };

  await params.stateStore.writeWorkerIdentity(nextIdentity);
  return nextIdentity;
}

function printWorkerRunHelp(io: CliIo): { exitCode: number } {
  io.stdout([
    'Usage: omp worker run --team <name> --worker <name>',
    '',
    'Options:',
    '  --team <name>    Team name (fallback: OMP_TEAM_WORKER)',
    '  --worker <name>  Worker name (fallback: OMP_WORKER_NAME / OMP_TEAM_WORKER)',
    '  --help           Show command help',
  ].join('\n'));
  return { exitCode: 0 };
}

export async function executeWorkerRunCommand(
  argv: string[],
  context: WorkerRunCommandContext,
): Promise<{ exitCode: number }> {
  const { cwd, io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    return printWorkerRunHelp(io);
  }

  const unknownOptions = findUnknownOptions(parsed.options, ['team', 'worker', 'help', 'h']);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    printWorkerRunHelp(io);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    printWorkerRunHelp(io);
    return { exitCode: 2 };
  }

  let teamName = getStringOption(parsed.options, ['team']);
  let workerName = getStringOption(parsed.options, ['worker']);

  if (!teamName) {
    const combined = process.env.OMP_TEAM_WORKER;
    teamName = combined?.split('/')[0];
  }
  if (!workerName) {
    workerName =
      process.env.OMP_WORKER_NAME ??
      process.env.OMP_TEAM_WORKER?.split('/')[1];
  }

  if (!teamName || !workerName) {
    io.stderr('[oh-my-product] worker run: --team and --worker are required');
    return { exitCode: 2 };
  }

  io.stdout(`[oh-my-product] worker ${workerName} starting for team ${teamName}`);
  await processSubagentStart({ cwd, id: `${teamName}/${workerName}`, type: 'worker', teamName }).catch(() => undefined);

  const stateStore = new TeamStateStore({ cwd });
  let workerIdentity = await stateStore.readWorkerIdentity(teamName, workerName).catch(() => null);
  const executionContract = parseWorkerExecutionContract(teamName, workerName, workerIdentity);
  const preClaimedTaskId = process.env.OMP_WORKER_TASK_ID;
  const preClaimedToken = process.env.OMP_WORKER_CLAIM_TOKEN;
  let heartbeatWriteChain: Promise<void> = Promise.resolve();

  const queueHeartbeatWrite = (alive: boolean): void => {
    heartbeatWriteChain = heartbeatWriteChain.then(() =>
      stateStore
        .writeWorkerHeartbeat(
          buildHeartbeatSignal({
            teamName,
            workerName,
            alive,
            pid: process.pid,
            currentTaskId: preClaimedTaskId,
          }),
        )
        .catch(() => undefined),
    );
  };

  await stateStore
    .writeWorkerStatus(teamName, workerName, {
      state: 'in_progress',
      updatedAt: new Date().toISOString(),
    })
    .catch(() => undefined);

  queueHeartbeatWrite(true);
  await heartbeatWriteChain;

  const heartbeatInterval = setInterval(() => {
    queueHeartbeatWrite(true);
  }, 30_000);
  heartbeatInterval.unref?.();

  let activeGeminiChild: ChildProcess | null = null;
  let activeChildPid: number | undefined;
  let signalForwardingMode: SignalForwardingMode = 'wrapper-forward';

  if (executionContract) {
    workerIdentity = await updateWorkerIdentityMetadata({
      stateStore,
      teamName,
      workerName,
      identity: workerIdentity,
      metadata: {
        wrapperPid: process.pid,
        signalForwardingMode,
      },
    }).catch(() => workerIdentity);
  }

  let exitCode = 0;
  let doneStatus: 'completed' | 'failed' = 'completed';
  let doneSummary = `Worker ${workerName} completed task for team ${teamName}`;
  let doneError: string | undefined;
  let roleOutput: Record<string, unknown> | undefined;
  let signalHandlersInstalled = false;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  try {
    const contextContent = await readTeamContext(cwd);
    const contextPath = path.join(cwd, '.gemini', 'GEMINI.md');
    if (contextContent) {
      io.stdout(`[oh-my-product] team context loaded (${contextContent.length} chars)`);
    }

    io.stdout(`[oh-my-product] worker ${workerName} executing task for team ${teamName}`);

    const workerCli = resolveWorkerCliMode(process.env);
    if (workerCli === 'gemini') {
      const runGeminiPrompt = context.runGeminiPromptFn ?? defaultRunGeminiPrompt;
      const prompt = buildGeminiWorkerPrompt({
        teamName,
        workerName,
        taskId: preClaimedTaskId,
        contextPath,
        contextContent,
        executionContract,
      });
      const installSignalForwarding = (): void => {
        if (signalHandlersInstalled) {
          return;
        }
        signalHandlersInstalled = true;
        (['SIGTERM', 'SIGINT'] as const).forEach((signal) => {
          const handler = () => {
            if (activeGeminiChild && !activeGeminiChild.killed) {
              activeGeminiChild.kill(signal);
            }
          };
          signalHandlers.set(signal, handler);
          process.on(signal, handler);
        });
      };

      const promptResult = await runGeminiPrompt({
        prompt,
        cwd,
        env: process.env,
        onSpawn: (child) => {
          activeGeminiChild = child;
          activeChildPid =
            typeof child.pid === 'number' && Number.isInteger(child.pid)
              ? child.pid
              : undefined;
          installSignalForwarding();
          if (executionContract) {
            updateWorkerIdentityMetadata({
              stateStore,
              teamName,
              workerName,
              identity: workerIdentity,
              metadata: {
                wrapperPid: process.pid,
                childPid: activeChildPid,
                signalForwardingMode,
              },
            }).then((updatedIdentity) => {
              workerIdentity = updatedIdentity;
            }).catch(() => undefined);
          }
        },
      });

      const geminiStdout =
        typeof promptResult === 'string'
          ? promptResult
          : promptResult?.stdout ?? '';
      const resultChildPid =
        typeof promptResult === 'object' && promptResult !== null
          ? promptResult.childPid
          : undefined;
      if (resultChildPid !== undefined) {
        activeChildPid = resultChildPid;
      }

      if (executionContract) {
        roleOutput = parseGeminiRoleOutput(geminiStdout, executionContract);
        await persistRoleOutputArtifacts(cwd, roleOutput);
        doneSummary = readString(roleOutput.summary) ?? doneSummary;
      }
    }

    if (preClaimedTaskId && preClaimedToken) {
      const controlPlane = new TaskControlPlane({ stateStore });
      await controlPlane
        .transitionTaskStatus({
          teamName,
          taskId: preClaimedTaskId,
          worker: workerName,
          claimToken: preClaimedToken,
          from: 'in_progress',
          to: 'completed',
          result: `Worker ${workerName} completed task ${preClaimedTaskId}`,
        })
        .catch((err) => {
          io.stderr(
            `[oh-my-product] failed to transition task status: ${(err as Error).message}`,
          );
        });
    }

    await stateStore
      .writeWorkerStatus(teamName, workerName, {
        state: 'idle',
        currentTaskId: preClaimedTaskId,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  } catch (error) {
    doneStatus = 'failed';
    doneError = (error as Error).message;
    doneSummary = `Worker ${workerName} failed task for team ${teamName}: ${doneError}`;
    io.stderr(`[oh-my-product] worker ${workerName} failed: ${doneError}`);
    exitCode = 1;
    await stateStore
      .writeWorkerStatus(teamName, workerName, {
        state: 'failed',
        currentTaskId: preClaimedTaskId,
        reason: doneError,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  } finally {
    for (const [signal, handler] of signalHandlers.entries()) {
      process.off(signal, handler);
    }
    clearInterval(heartbeatInterval);
    await heartbeatWriteChain.catch(() => undefined);

    await stateStore
      .writeWorkerDone({
        teamName,
        workerName,
        status: doneStatus,
        completedAt: new Date().toISOString(),
        summary: doneSummary,
        error: doneError,
        taskId: preClaimedTaskId,
        metadata: {
          wrapperPid: process.pid,
          childPid: activeChildPid,
          signalForwardingMode,
          roleArtifactBase: executionContract?.roleArtifactBase,
          roleOutput,
        },
      })
      .catch((err) => {
        io.stderr(`[oh-my-product] failed to write done signal: ${(err as Error).message}`);
      });

    await stateStore
      .writeWorkerHeartbeat(
        buildHeartbeatSignal({
          teamName,
          workerName,
          alive: false,
          pid: process.pid,
          currentTaskId: preClaimedTaskId,
        }),
      )
      .catch(() => undefined);

    await processSubagentStop({
      cwd,
      id: `${teamName}/${workerName}`,
      status: doneStatus,
      summary: doneSummary,
    }).catch(() => undefined);
  }

  io.stdout(`[oh-my-product] worker ${workerName} done`);
  return { exitCode };
}
