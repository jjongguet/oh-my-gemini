import { MODE_NAMES } from '../lib/mode-names.js';
import { clearModeStateFile, readModeState, writeModeState } from '../lib/mode-state-io.js';
import { recordSuccessfulCompletion } from '../hooks/learner/index.js';
import { recordProjectMemoryTask } from '../hooks/project-memory/index.js';
import { handleRecovery } from '../hooks/recovery/index.js';
import { routePromptToMode } from '../hooks/keyword-detector/index.js';
import { buildModeTeamName, buildTeamStartInput, defaultVerify, nowIso, runTeamExecution } from './common.js';
import type { ExecutionMode, ModeExecutionDependencies, ModeExecutionRequest, ModeExecutionResult } from './types.js';

export interface AutopilotState {
  active: boolean;
  sessionId?: string;
  phase: 'planning' | 'executing' | 'verifying' | 'completed' | 'failed';
  prompt: string;
  teamName: string;
  startedAt: string;
  updatedAt: string;
  workers: number;
}

export function readAutopilotState(cwd: string, sessionId?: string): AutopilotState | null {
  return readModeState<AutopilotState>(MODE_NAMES.AUTOPILOT, cwd, sessionId);
}

export function writeAutopilotState(cwd: string, state: AutopilotState, sessionId?: string): boolean {
  return writeModeState(MODE_NAMES.AUTOPILOT, state as unknown as Record<string, unknown>, cwd, sessionId);
}

export function clearAutopilotState(cwd: string, sessionId?: string): boolean {
  return clearModeStateFile(MODE_NAMES.AUTOPILOT, cwd, sessionId);
}

export async function activateAutopilot(request: ModeExecutionRequest, deps?: ModeExecutionDependencies): Promise<AutopilotState> {
  const state: AutopilotState = {
    active: true,
    sessionId: request.sessionId,
    phase: 'planning',
    prompt: request.prompt,
    teamName: buildModeTeamName(MODE_NAMES.AUTOPILOT, request),
    startedAt: nowIso(deps),
    updatedAt: nowIso(deps),
    workers: request.workers ?? 1,
  };
  writeAutopilotState(request.cwd, state, request.sessionId);
  return state;
}

export async function executeAutopilotMode(
  request: ModeExecutionRequest,
  deps?: ModeExecutionDependencies,
): Promise<ModeExecutionResult<AutopilotState>> {
  const state = await activateAutopilot(request, deps);
  state.phase = 'executing';
  state.updatedAt = nowIso(deps);
  writeAutopilotState(request.cwd, state, request.sessionId);

  const teamInput = buildTeamStartInput(MODE_NAMES.AUTOPILOT, request, {
    teamName: state.teamName,
    workers: request.workers ?? routePromptToMode(request.prompt).workerCount ?? 1,
  });

  const runResult = await handleRecovery({
    operation: () => runTeamExecution(teamInput, deps),
    maxAttempts: 2,
  });

  state.phase = 'verifying';
  state.updatedAt = nowIso(deps);
  writeAutopilotState(request.cwd, state, request.sessionId);

  const verified = await (deps?.verifyResult?.(runResult, 1, request) ?? defaultVerify(runResult));
  state.phase = verified ? 'completed' : 'failed';
  state.active = false;
  state.updatedAt = nowIso(deps);
  writeAutopilotState(request.cwd, state, request.sessionId);

  let learnedSkillId: string | undefined;
  if (verified) {
    const pattern = await recordSuccessfulCompletion({
      cwd: request.cwd,
      mode: MODE_NAMES.AUTOPILOT,
      prompt: request.prompt,
      result: runResult,
      workers: teamInput.workers,
    });
    learnedSkillId = pattern?.id;
    await recordProjectMemoryTask({ cwd: request.cwd, task: request.task ?? request.prompt, mode: MODE_NAMES.AUTOPILOT, learnedSkillId });
  }

  return {
    mode: MODE_NAMES.AUTOPILOT,
    success: verified,
    completed: verified,
    iterations: 1,
    summary: verified ? 'Autopilot completed the task end-to-end.' : 'Autopilot failed verification.',
    state,
    lastRunResult: runResult,
    learnedSkillId,
  };
}

export const autopilotMode: ExecutionMode<AutopilotState> = {
  name: MODE_NAMES.AUTOPILOT,
  description: 'Autonomous end-to-end execution.',
  shouldActivate(prompt: string): boolean {
    return routePromptToMode(prompt).mode === MODE_NAMES.AUTOPILOT;
  },
  activate: activateAutopilot,
  execute: executeAutopilotMode,
};
