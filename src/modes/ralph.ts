import { MODE_NAMES } from '../lib/mode-names.js';
import { clearModeStateFile, readModeState, writeModeState } from '../lib/mode-state-io.js';
import { recordSuccessfulCompletion } from '../hooks/learner/index.js';
import { recordProjectMemoryTask } from '../hooks/project-memory/index.js';
import { detectRecoverableError, handleRecovery } from '../hooks/recovery/index.js';
import { routePromptToMode } from '../hooks/keyword-detector/index.js';
import { buildModeTeamName, buildTeamStartInput, defaultVerify, nowIso, runTeamExecution } from './common.js';
import type { ExecutionMode, ModeExecutionDependencies, ModeExecutionRequest, ModeExecutionResult } from './types.js';

export interface RalphState {
  active: boolean;
  sessionId?: string;
  iteration: number;
  maxIterations: number;
  prompt: string;
  teamName: string;
  phase: 'executing' | 'verifying' | 'completed' | 'failed';
  startedAt: string;
  updatedAt: string;
}

export function readRalphState(cwd: string, sessionId?: string): RalphState | null {
  return readModeState<RalphState>(MODE_NAMES.RALPH, cwd, sessionId);
}

export function writeRalphState(cwd: string, state: RalphState, sessionId?: string): boolean {
  return writeModeState(MODE_NAMES.RALPH, state as unknown as Record<string, unknown>, cwd, sessionId);
}

export function clearRalphState(cwd: string, sessionId?: string): boolean {
  return clearModeStateFile(MODE_NAMES.RALPH, cwd, sessionId);
}

export async function activateRalph(request: ModeExecutionRequest, deps?: ModeExecutionDependencies): Promise<RalphState> {
  const state: RalphState = {
    active: true,
    sessionId: request.sessionId,
    iteration: 0,
    maxIterations: Math.max(1, request.maxIterations ?? 3),
    prompt: request.prompt,
    teamName: buildModeTeamName(MODE_NAMES.RALPH, request),
    phase: 'executing',
    startedAt: nowIso(deps),
    updatedAt: nowIso(deps),
  };
  writeRalphState(request.cwd, state, request.sessionId);
  return state;
}

export async function executeRalphMode(
  request: ModeExecutionRequest,
  deps?: ModeExecutionDependencies,
): Promise<ModeExecutionResult<RalphState>> {
  const state = await activateRalph(request, deps);
  let lastRunResult;
  let learnedSkillId: string | undefined;

  for (let iteration = 1; iteration <= state.maxIterations; iteration += 1) {
    state.iteration = iteration;
    state.phase = 'executing';
    state.updatedAt = nowIso(deps);
    writeRalphState(request.cwd, state, request.sessionId);

    try {
      lastRunResult = await handleRecovery({
        operation: () => runTeamExecution(buildTeamStartInput(MODE_NAMES.RALPH, request, { teamName: state.teamName }), deps),
        maxAttempts: 2,
      });
    } catch (error) {
      const decision = detectRecoverableError(error);
      if (!decision.shouldRetry || iteration >= state.maxIterations) {
        state.phase = 'failed';
        state.active = false;
        state.updatedAt = nowIso(deps);
        writeRalphState(request.cwd, state, request.sessionId);
        return {
          mode: MODE_NAMES.RALPH,
          success: false,
          completed: false,
          iterations: iteration,
          summary: decision.message,
          state,
        };
      }
      continue;
    }

    state.phase = 'verifying';
    state.updatedAt = nowIso(deps);
    writeRalphState(request.cwd, state, request.sessionId);

    const verified = await (deps?.verifyResult?.(lastRunResult, iteration, request) ?? defaultVerify(lastRunResult));
    if (verified) {
      state.phase = 'completed';
      state.active = false;
      state.updatedAt = nowIso(deps);
      writeRalphState(request.cwd, state, request.sessionId);
      const pattern = await recordSuccessfulCompletion({
        cwd: request.cwd,
        mode: MODE_NAMES.RALPH,
        prompt: request.prompt,
        result: lastRunResult,
        workers: request.workers,
      });
      learnedSkillId = pattern?.id;
      await recordProjectMemoryTask({ cwd: request.cwd, task: request.task ?? request.prompt, mode: MODE_NAMES.RALPH, learnedSkillId });
      return {
        mode: MODE_NAMES.RALPH,
        success: true,
        completed: true,
        iterations: iteration,
        summary: `Ralph verified completion after ${iteration} iteration(s).`,
        state,
        lastRunResult,
        learnedSkillId,
      };
    }
  }

  state.phase = 'failed';
  state.active = false;
  state.updatedAt = nowIso(deps);
  writeRalphState(request.cwd, state, request.sessionId);
  return {
    mode: MODE_NAMES.RALPH,
    success: false,
    completed: false,
    iterations: state.iteration,
    summary: `Ralph exhausted ${state.maxIterations} iteration(s) without verified completion.`,
    state,
    lastRunResult,
  };
}

export const ralphMode: ExecutionMode<RalphState> = {
  name: MODE_NAMES.RALPH,
  description: 'Persistent verify/fix loop that refuses to give up.',
  shouldActivate(prompt: string): boolean {
    return routePromptToMode(prompt).mode === MODE_NAMES.RALPH;
  },
  activate: activateRalph,
  execute: executeRalphMode,
};
