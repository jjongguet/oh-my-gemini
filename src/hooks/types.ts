export interface HookContext {
  teamName: string;
  cwd: string;
  task: string;
  workers: number;
  stateRoot: string;
}

export interface HookDecisionOutput {
  continue: boolean;
  suppressOutput?: boolean;
  hookSpecificOutput?: {
    hookEventName: 'PreToolUse' | 'Stop' | 'Cancel';
    additionalContext: string;
  };
}

export interface HookBaseInput {
  context: HookContext;
  now?: Date;
  metadata?: Record<string, unknown>;
}

export interface HookPreToolInput extends HookBaseInput {
  toolName: string;
  toolInput?: unknown;
}

export interface HookStopInput extends HookBaseInput {
  stopReason?: string;
}

export interface HookCancelInput extends HookBaseInput {
  cancelReason?: string;
  cancelledBy?: string;
}

export type LifecycleHookInput =
  | { event: 'pre-tool'; payload: HookPreToolInput }
  | { event: 'stop'; payload: HookStopInput }
  | { event: 'cancel'; payload: HookCancelInput };
