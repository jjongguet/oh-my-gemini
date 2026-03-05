import { formatInjectedHookContext } from './lifecycle-context.js';
import type { HookCancelInput, HookDecisionOutput } from './types.js';

export function processCancelHook(input: HookCancelInput): HookDecisionOutput {
  const additionalContext = formatInjectedHookContext({
    event: 'cancel',
    context: input.context,
    now: input.now,
    reason: input.cancelReason,
    metadata: {
      ...(input.metadata ?? {}),
      cancelledBy: input.cancelledBy,
    },
  });

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'Cancel',
      additionalContext,
    },
  };
}

export async function handleCancelHook(
  input: HookCancelInput,
): Promise<HookDecisionOutput> {
  return processCancelHook(input);
}
