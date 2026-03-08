import type { ModeName } from '../lib/mode-names.js';
import type { RuntimeBackendName } from '../team/runtime/runtime-backend.js';
import type { TeamRunResult, TeamStartInput } from '../team/types.js';

export interface ModeExecutionRequest {
  cwd: string;
  prompt: string;
  sessionId?: string;
  task?: string;
  teamName?: string;
  backend?: RuntimeBackendName;
  workers?: number;
  maxIterations?: number;
  metadata?: Record<string, unknown>;
}

export interface ModeExecutionDependencies {
  runTeam?: (input: TeamStartInput) => Promise<TeamRunResult>;
  verifyResult?: (result: TeamRunResult, iteration: number, request: ModeExecutionRequest) => Promise<boolean> | boolean;
  now?: () => string;
}

export interface ModeExecutionResult<TState extends object> {
  mode: ModeName;
  success: boolean;
  completed: boolean;
  iterations: number;
  summary: string;
  state: TState;
  lastRunResult?: TeamRunResult;
  learnedSkillId?: string;
}

export interface ExecutionMode<TState extends object> {
  name: ModeName;
  description: string;
  shouldActivate(prompt: string): boolean;
  activate(request: ModeExecutionRequest): Promise<TState>;
  execute(request: ModeExecutionRequest, deps?: ModeExecutionDependencies): Promise<ModeExecutionResult<TState>>;
}
