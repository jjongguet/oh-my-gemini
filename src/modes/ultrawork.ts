import { MODE_NAMES } from '../lib/mode-names.js';
import { clearModeStateFile, readModeState, writeModeState } from '../lib/mode-state-io.js';
import { recordSuccessfulCompletion } from '../hooks/learner/index.js';
import { routePromptToMode } from '../hooks/keyword-detector/index.js';
import { recordProjectMemoryTask } from '../hooks/project-memory/index.js';
import { handleRecovery } from '../hooks/recovery/index.js';
import { buildModeTeamName, buildTeamStartInput, defaultVerify, nowIso, runTeamExecution } from './common.js';
import type { ExecutionMode, ModeExecutionDependencies, ModeExecutionRequest, ModeExecutionResult } from './types.js';

export interface UltraworkState {
  active: boolean;
  sessionId?: string;
  phase: 'parallelizing' | 'running' | 'verifying' | 'completed' | 'failed';
  prompt: string;
  teamName: string;
  workers: number;
  startedAt: string;
  updatedAt: string;
}

export function readUltraworkState(cwd: string, sessionId?: string): UltraworkState | null {
  return readModeState<UltraworkState>(MODE_NAMES.ULTRAWORK, cwd, sessionId);
}

export function writeUltraworkState(cwd: string, state: UltraworkState, sessionId?: string): boolean {
  return writeModeState(MODE_NAMES.ULTRAWORK, state as unknown as Record<string, unknown>, cwd, sessionId);
}

export function clearUltraworkState(cwd: string, sessionId?: string): boolean {
  return clearModeStateFile(MODE_NAMES.ULTRAWORK, cwd, sessionId);
}

export async function activateUltrawork(request: ModeExecutionRequest, deps?: ModeExecutionDependencies): Promise<UltraworkState> {
  const routed = routePromptToMode(request.prompt);
  const workers = request.workers ?? routed.workerCount ?? 6;
  const state: UltraworkState = {
    active: true,
    sessionId: request.sessionId,
    phase: 'parallelizing',
    prompt: request.prompt,
    teamName: buildModeTeamName(MODE_NAMES.ULTRAWORK, request),
    workers,
    startedAt: nowIso(deps),
    updatedAt: nowIso(deps),
  };
  writeUltraworkState(request.cwd, state, request.sessionId);
  return state;
}

export async function executeUltraworkMode(
  request: ModeExecutionRequest,
  deps?: ModeExecutionDependencies,
): Promise<ModeExecutionResult<UltraworkState>> {
  const state = await activateUltrawork(request, deps);
  state.phase = 'running';
  state.updatedAt = nowIso(deps);
  writeUltraworkState(request.cwd, state, request.sessionId);

  const teamInput = buildTeamStartInput(MODE_NAMES.ULTRAWORK, request, {
    teamName: state.teamName,
    workers: state.workers,
  });

  const runResult = await handleRecovery({
    operation: () => runTeamExecution(teamInput, deps),
    maxAttempts: 2,
  });

  state.phase = 'verifying';
  state.updatedAt = nowIso(deps);
  writeUltraworkState(request.cwd, state, request.sessionId);

  const verified = await (deps?.verifyResult?.(runResult, 1, request) ?? defaultVerify(runResult));
  state.phase = verified ? 'completed' : 'failed';
  state.active = false;
  state.updatedAt = nowIso(deps);
  writeUltraworkState(request.cwd, state, request.sessionId);

  let learnedSkillId: string | undefined;
  if (verified) {
    const pattern = await recordSuccessfulCompletion({
      cwd: request.cwd,
      mode: MODE_NAMES.ULTRAWORK,
      prompt: request.prompt,
      result: runResult,
      workers: state.workers,
    });
    learnedSkillId = pattern?.id;
    await recordProjectMemoryTask({ cwd: request.cwd, task: request.task ?? request.prompt, mode: MODE_NAMES.ULTRAWORK, learnedSkillId });
  }

  return {
    mode: MODE_NAMES.ULTRAWORK,
    success: verified,
    completed: verified,
    iterations: 1,
    summary: verified
      ? `Ultrawork completed with ${state.workers} parallel worker(s).`
      : 'Ultrawork finished but did not satisfy verification.',
    state,
    lastRunResult: runResult,
    learnedSkillId,
  };
}

export const ultraworkMode: ExecutionMode<UltraworkState> = {
  name: MODE_NAMES.ULTRAWORK,
  description: 'Maximum parallelism mode for burst fixes.',
  shouldActivate(prompt: string): boolean {
    return routePromptToMode(prompt).mode === MODE_NAMES.ULTRAWORK;
  },
  activate: activateUltrawork,
  execute: executeUltraworkMode,
};
