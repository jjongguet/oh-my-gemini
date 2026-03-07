export type HudPreset = 'minimal' | 'focused' | 'full';

export interface HudConfig {
  preset: HudPreset;
}

export const DEFAULT_HUD_CONFIG: HudConfig = {
  preset: 'focused',
};

export type GeminiApiKeySource = 'env' | 'oauth' | 'unknown';

export interface TeamHudProgress {
  total: number;
  completed: number;
  inProgress: number;
  percent: number;
}

export interface TeamHudWorkerProgress {
  total: number;
  running: number;
  done: number;
  failed: number;
  percent: number;
}

export interface TeamHudSummary {
  teamName: string;
  hasState: boolean;
  phase: string;
  runtimeStatus: string;
  updatedAt?: string;
  tasks: TeamHudProgress;
  workers: TeamHudWorkerProgress;
}

export interface GeminiApiSnapshot {
  model: string | null;
  keySource: GeminiApiKeySource;
  windowPercent?: number;
  quotaPercent?: number;
  rateLimited?: boolean;
  updatedAt?: string;
}

export interface HudRenderContext {
  version: string | null;
  gitBranch: string | null;
  team: TeamHudSummary;
  gemini: GeminiApiSnapshot;
  generatedAt: string;
}
