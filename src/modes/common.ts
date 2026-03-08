import { randomUUID } from 'node:crypto';

import { normalizeTeamNameCanonical } from '../common/team-name.js';
import type { ModeName } from '../lib/mode-names.js';
import { TeamOrchestrator } from '../team/index.js';
import type { RuntimeBackendName } from '../team/runtime/runtime-backend.js';
import type { TeamRunResult, TeamStartInput } from '../team/types.js';
import type { ModeExecutionDependencies, ModeExecutionRequest } from './types.js';

export function nowIso(deps?: ModeExecutionDependencies): string {
  return deps?.now?.() ?? new Date().toISOString();
}

function sanitizePrompt(prompt: string): string {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildModeTeamName(mode: ModeName, request: ModeExecutionRequest): string {
  const candidate = request.teamName ?? `${mode}-${sanitizePrompt(request.task ?? request.prompt).slice(0, 48) || randomUUID()}`;
  return normalizeTeamNameCanonical(candidate);
}

export function defaultWorkers(mode: ModeName, requested?: number): number {
  if (requested && requested > 0) {
    return requested;
  }

  if (mode === 'ultrawork') {
    return 6;
  }

  return 1;
}

export function buildTeamStartInput(
  mode: ModeName,
  request: ModeExecutionRequest,
  overrides: Partial<TeamStartInput> = {},
): TeamStartInput {
  const backend: RuntimeBackendName = overrides.backend ?? request.backend ?? 'tmux';
  return {
    teamName: overrides.teamName ?? buildModeTeamName(mode, request),
    task: overrides.task ?? request.task ?? request.prompt,
    cwd: request.cwd,
    backend,
    workers: overrides.workers ?? defaultWorkers(mode, request.workers),
    env: overrides.env,
    subagents: overrides.subagents,
    maxFixAttempts: overrides.maxFixAttempts,
    watchdogMs: overrides.watchdogMs,
    nonReportingMs: overrides.nonReportingMs,
    metadata: {
      ...(request.metadata ?? {}),
      ...(overrides.metadata ?? {}),
      executionMode: mode,
      sessionId: request.sessionId,
    },
  };
}

export async function runTeamExecution(
  input: TeamStartInput,
  deps?: ModeExecutionDependencies,
): Promise<TeamRunResult> {
  const runTeam = deps?.runTeam ?? ((teamInput: TeamStartInput) => new TeamOrchestrator().run(teamInput));
  return runTeam(input);
}

export function defaultVerify(result: TeamRunResult): boolean {
  return result.success && result.status === 'completed' && result.phase === 'completed';
}
