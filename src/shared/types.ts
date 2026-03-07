/**
 * Shared types for Oh-My-Gemini
 */

export type ModelType = 'flash' | 'pro' | 'ultra' | 'flash-thinking' | 'pro-thinking' | 'inherit';

export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: ModelType;
  defaultModel?: ModelType;
}

export interface PluginConfig {
  agents?: Record<string, { model?: string; enabled?: boolean }>;

  features?: {
    parallelExecution?: boolean;
    lspTools?: boolean;
    astTools?: boolean;
    continuationEnforcement?: boolean;
    autoContextInjection?: boolean;
  };

  mcpServers?: Record<string, { enabled?: boolean; apiKey?: string }>;

  permissions?: {
    allowBash?: boolean;
    allowEdit?: boolean;
    allowWrite?: boolean;
    maxBackgroundTasks?: number;
  };

  routing?: {
    enabled?: boolean;
    defaultTier?: 'LOW' | 'MEDIUM' | 'HIGH';
    forceInherit?: boolean;
    escalationEnabled?: boolean;
    maxEscalations?: number;
    tierModels?: {
      LOW?: string;
      MEDIUM?: string;
      HIGH?: string;
    };
    agentOverrides?: Record<string, {
      tier: 'LOW' | 'MEDIUM' | 'HIGH';
      reason: string;
    }>;
    modelAliases?: Partial<Record<'flash' | 'pro' | 'ultra', ModelType>>;
    escalationKeywords?: string[];
    simplificationKeywords?: string[];
  };

  startupCodebaseMap?: {
    enabled?: boolean;
    maxFiles?: number;
    maxDepth?: number;
  };

  taskSizeDetection?: {
    enabled?: boolean;
    smallWordLimit?: number;
    largeWordLimit?: number;
    suppressHeavyModesForSmallTasks?: boolean;
  };
}

export interface SessionState {
  sessionId?: string;
  activeAgents: Map<string, AgentState>;
  backgroundTasks: BackgroundTask[];
  contextFiles: string[];
}

export interface AgentState {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastMessage?: string;
  startTime?: number;
}

export interface BackgroundTask {
  id: string;
  agentName: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
}

export interface HookDefinition {
  event: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'SessionStart' | 'SessionEnd' | 'UserPromptSubmit';
  matcher?: string;
  command?: string;
  handler?: (context: HookContext) => Promise<HookResult>;
}

export interface HookContext {
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  sessionId?: string;
}

export interface HookResult {
  continue: boolean;
  message?: string;
  modifiedInput?: unknown;
}
