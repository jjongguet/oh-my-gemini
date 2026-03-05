import { formatInjectedHookContext } from './lifecycle-context.js';
import type { HookDecisionOutput, HookPreToolInput } from './types.js';

export function processPreToolHook(input: HookPreToolInput): HookDecisionOutput {
  const additionalContext = formatInjectedHookContext({
    event: 'pre-tool',
    context: input.context,
    now: input.now,
    reason: `tool=${input.toolName}`,
    metadata: {
      ...(input.metadata ?? {}),
      toolName: input.toolName,
      toolInput: input.toolInput,
    },
  });

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext,
    },
  };
}

export async function handlePreToolHook(
  input: HookPreToolInput,
): Promise<HookDecisionOutput> {
  return processPreToolHook(input);
}
