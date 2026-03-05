import { formatInjectedHookContext } from './lifecycle-context.js';
import type { HookDecisionOutput, HookStopInput } from './types.js';

export function processStopHook(input: HookStopInput): HookDecisionOutput {
  const additionalContext = formatInjectedHookContext({
    event: 'stop',
    context: input.context,
    now: input.now,
    reason: input.stopReason,
    metadata: input.metadata,
  });

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext,
    },
  };
}

export async function handleStopHook(input: HookStopInput): Promise<HookDecisionOutput> {
  return processStopHook(input);
}
