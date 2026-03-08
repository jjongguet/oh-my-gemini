import type { ModeName } from '../lib/mode-names.js';

export type HookEventName =
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact';

export interface HookContext {
  event?: HookEventName;
  teamName?: string;
  cwd: string;
  task?: string;
  workers?: number;
  stateRoot?: string;
  sessionId?: string;
  prompt?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  permissionRequest?: string;
  metadata?: Record<string, unknown>;
}

export interface HookResult {
  continue: boolean;
  message?: string;
  systemMessage?: string;
  activatedMode?: ModeName;
  reroutedTask?: string;
  data?: Record<string, unknown>;
  warnings?: string[];
}

export interface RegisteredHook {
  name: string;
  events: readonly HookEventName[];
  priority?: number;
  handler: (context: HookContext) => Promise<HookResult>;
}
