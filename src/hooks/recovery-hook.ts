import { detectRecoverableError } from './recovery/index.js';
import type { HookContext, HookResult, RegisteredHook } from './types.js';

export async function processRecoveryHook(context: HookContext): Promise<HookResult> {
  const payload = context.toolOutput instanceof Error
    ? context.toolOutput
    : typeof context.toolOutput === 'string'
      ? new Error(context.toolOutput)
      : null;

  if (!payload) {
    return { continue: true, message: 'Recovery hook observed no error payload.' };
  }

  const decision = detectRecoverableError(payload);
  return {
    continue: true,
    message: decision.message,
    data: { decision },
  };
}

export function createRecoveryHook(): RegisteredHook {
  return {
    name: 'recovery',
    events: ['PostToolUse', 'SessionEnd'],
    priority: 25,
    handler: processRecoveryHook,
  };
}
