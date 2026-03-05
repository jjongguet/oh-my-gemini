import { processCancelHook } from './cancel.js';
import { processPreToolHook } from './pre-tool.js';
import { processStopHook } from './stop.js';
import type { HookDecisionOutput, LifecycleHookInput } from './types.js';

export function processLifecycleHook(input: LifecycleHookInput): HookDecisionOutput {
  switch (input.event) {
    case 'pre-tool':
      return processPreToolHook(input.payload);
    case 'stop':
      return processStopHook(input.payload);
    case 'cancel':
      return processCancelHook(input.payload);
    default: {
      const exhaustive: never = input;
      throw new Error(`Unsupported lifecycle hook event: ${String(exhaustive)}`);
    }
  }
}
