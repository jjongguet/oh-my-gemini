import path from 'node:path';

import { TeamStateStore } from '../../state/index.js';
import { readTeamContext } from '../../hooks/index.js';
import { TaskControlPlane } from '../../team/control-plane/index.js';
import { buildHeartbeatSignal } from '../../team/worker-signals.js';
import type { CliIo } from '../types.js';

export interface WorkerRunCommandContext {
  cwd: string;
  io: CliIo;
}

export async function executeWorkerRunCommand(
  argv: string[],
  context: WorkerRunCommandContext,
): Promise<{ exitCode: number }> {
  const { cwd, io } = context;

  let teamName: string | undefined;
  let workerName: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--team' && i + 1 < argv.length) {
      teamName = argv[++i];
    } else if (argv[i] === '--worker' && i + 1 < argv.length) {
      workerName = argv[++i];
    }
  }

  // Fall back to injected env vars from tmux backend
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

  const stateStore = new TeamStateStore({ cwd });

  // Write running status
  await stateStore
    .writeWorkerStatus(teamName, workerName, {
      state: 'in_progress',
      updatedAt: new Date().toISOString(),
    })
    .catch(() => undefined);

  // Write initial heartbeat
  await stateStore
    .writeWorkerHeartbeat(buildHeartbeatSignal({ teamName, workerName, alive: true }))
    .catch(() => undefined);

  // Periodic heartbeat — keeps orchestrator watchdog alive every 30s
  const heartbeatInterval = setInterval(() => {
    stateStore
      .writeWorkerHeartbeat(buildHeartbeatSignal({ teamName, workerName, alive: true }))
      .catch(() => undefined);
  }, 30_000);

  // Read task claim from env (set by orchestrator pre-assignment)
  const preClaimedTaskId = process.env.OMG_WORKER_TASK_ID;
  const preClaimedToken = process.env.OMG_WORKER_CLAIM_TOKEN;

  // Read team context (GEMINI.md written by Hook System)
  const contextContent = await readTeamContext(cwd);
  if (contextContent) {
    io.stdout(`[oh-my-gemini] team context loaded (${contextContent.length} chars)`);
  }

  io.stdout(`[oh-my-gemini] worker ${workerName} executing task for team ${teamName}`);

  // Stop periodic heartbeat before writing terminal signals
  clearInterval(heartbeatInterval);

  // Write completion done signal
  await stateStore
    .writeWorkerDone({
      teamName,
      workerName,
      status: 'completed',
      completedAt: new Date().toISOString(),
      summary: `Worker ${workerName} completed task for team ${teamName}`,
    })
    .catch((err) => {
      io.stderr(`[oh-my-gemini] failed to write done signal: ${(err as Error).message}`);
    });

  // Transition pre-claimed task to completed (orchestrator pre-assigned via env)
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

  // Write final heartbeat (alive: false)
  await stateStore
    .writeWorkerHeartbeat(buildHeartbeatSignal({ teamName, workerName, alive: false }))
    .catch(() => undefined);

  io.stdout(`[oh-my-gemini] worker ${workerName} done`);
  return { exitCode: 0 };
}
