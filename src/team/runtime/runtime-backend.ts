import type { TeamHandle, TeamSnapshot, TeamStartInput } from '../types.js';

export type RuntimeBackendName = 'tmux' | 'subagents' | 'gemini-spawn';

export interface RuntimeProbeResult {
  ok: boolean;
  issues: string[];
}

export interface RuntimeBackend {
  readonly name: RuntimeBackendName;
  probePrerequisites(cwd: string): Promise<RuntimeProbeResult>;
  startTeam(input: TeamStartInput): Promise<TeamHandle>;
  monitorTeam(handle: TeamHandle): Promise<TeamSnapshot>;
  shutdownTeam(handle: TeamHandle, opts?: { force?: boolean }): Promise<void>;
}
