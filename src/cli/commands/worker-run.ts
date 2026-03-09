import { spawn } from 'node:child_process';
import path from 'node:path';

import { readTeamContext } from '../../hooks/index.js';
import { processSubagentStart, processSubagentStop } from '../../hooks/subagent-tracker/index.js';
import { validatePayload } from '../../lib/payload-limits.js';
import { TeamStateStore } from '../../state/index.js';
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
  }) => Promise<void>;
}

const GEMINI_PROMPT_MAX_CHARS = 12_000;

type WorkerCliMode = 'omg' | 'gemini';

function resolveWorkerCliMode(env: NodeJS.ProcessEnv): WorkerCliMode {
  const raw = (env.OMG_TEAM_WORKER_CLI ?? env.OMX_TEAM_WORKER_CLI ?? 'omg').trim().toLowerCase();
  return raw === 'gemini' ? 'gemini' : 'omg';
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
}): string {
  const safeContext = truncatePromptContext(input.contextContent, input.contextPath);

  return [
    `You are oh-my-gemini worker ${input.workerName} for team ${input.teamName}.`,
    input.taskId ? `Pre-assigned task id: ${input.taskId}` : 'No explicit pre-assigned task id was provided.',
    'Follow the team context below, perform the assigned worker work, and then exit cleanly.',
    `Team context path: ${input.contextPath}`,
    '',
    '## Team Context',
    safeContext,
  ].join('\n');
}

async function defaultRunGeminiPrompt(input: {
  prompt: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('gemini', ['-p', input.prompt], {
      cwd: input.cwd,
      env: input.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
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

function printWorkerRunHelp(io: CliIo): { exitCode: number } {
  io.stdout([
    'Usage: omg worker run --team <name> --worker <name>',
    '',
    'Options:',
    '  --team <name>    Team name (fallback: OMG_TEAM_WORKER)',
    '  --worker <name>  Worker name (fallback: OMG_WORKER_NAME / OMG_TEAM_WORKER)',
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
    const combined = process.env.OMG_TEAM_WORKER;
    teamName = combined?.split('/')[0];
  }
  if (!workerName) {
    workerName =
      process.env.OMG_WORKER_NAME ??
      process.env.OMG_TEAM_WORKER?.split('/')[1];
  }

  if (!teamName || !workerName) {
    io.stderr('[oh-my-gemini] worker run: --team and --worker are required');
    return { exitCode: 2 };
  }

  io.stdout(`[oh-my-gemini] worker ${workerName} starting for team ${teamName}`);
  await processSubagentStart({ cwd, id: `${teamName}/${workerName}`, type: 'worker', teamName }).catch(() => undefined);

  const stateStore = new TeamStateStore({ cwd });
  let heartbeatWriteChain: Promise<void> = Promise.resolve();

  const queueHeartbeatWrite = (alive: boolean): void => {
    heartbeatWriteChain = heartbeatWriteChain.then(() =>
      stateStore
        .writeWorkerHeartbeat(buildHeartbeatSignal({ teamName, workerName, alive }))
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

  const preClaimedTaskId = process.env.OMG_WORKER_TASK_ID;
  const preClaimedToken = process.env.OMG_WORKER_CLAIM_TOKEN;

  let exitCode = 0;
  let doneStatus: 'completed' | 'failed' = 'completed';
  let doneSummary = `Worker ${workerName} completed task for team ${teamName}`;
  let doneError: string | undefined;

  try {
    const contextContent = await readTeamContext(cwd);
    const contextPath = path.join(cwd, '.gemini', 'GEMINI.md');
    if (contextContent) {
      io.stdout(`[oh-my-gemini] team context loaded (${contextContent.length} chars)`);
    }

    io.stdout(`[oh-my-gemini] worker ${workerName} executing task for team ${teamName}`);

    const workerCli = resolveWorkerCliMode(process.env);
    if (workerCli === 'gemini') {
      const runGeminiPrompt = context.runGeminiPromptFn ?? defaultRunGeminiPrompt;
      const prompt = buildGeminiWorkerPrompt({
        teamName,
        workerName,
        taskId: preClaimedTaskId,
        contextPath,
        contextContent,
      });
      await runGeminiPrompt({
        prompt,
        cwd,
        env: process.env,
      });
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
            `[oh-my-gemini] failed to transition task status: ${(err as Error).message}`,
          );
        });
    }
  } catch (error) {
    doneStatus = 'failed';
    doneError = (error as Error).message;
    doneSummary = `Worker ${workerName} failed task for team ${teamName}: ${doneError}`;
    io.stderr(`[oh-my-gemini] worker ${workerName} failed: ${doneError}`);
    exitCode = 1;
  } finally {
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
      })
      .catch((err) => {
        io.stderr(`[oh-my-gemini] failed to write done signal: ${(err as Error).message}`);
      });

    await stateStore
      .writeWorkerHeartbeat(buildHeartbeatSignal({ teamName, workerName, alive: false }))
      .catch(() => undefined);

    await processSubagentStop({
      cwd,
      id: `${teamName}/${workerName}`,
      status: doneStatus,
      summary: doneSummary,
    }).catch(() => undefined);
  }

  io.stdout(`[oh-my-gemini] worker ${workerName} done`);
  return { exitCode };
}
