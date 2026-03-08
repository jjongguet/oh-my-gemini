import { MODE_NAMES } from '../../lib/mode-names.js';
import { executeRalphMode } from '../../modes/ralph.js';
import type { ModeExecutionDependencies } from '../../modes/types.js';
import { canStartMode } from '../mode-registry/index.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';
import { routePromptToMode } from '../keyword-detector/index.js';

export function shouldActivateRalph(prompt: string): boolean {
  return routePromptToMode(prompt).mode === MODE_NAMES.RALPH;
}

export async function processRalphHook(
  context: HookContext,
  deps?: ModeExecutionDependencies,
): Promise<HookResult> {
  const prompt = context.prompt ?? context.task ?? '';
  if (!shouldActivateRalph(prompt)) {
    return { continue: true, message: 'Ralph hook did not activate.' };
  }

  if (!canStartMode(MODE_NAMES.RALPH, context.cwd, context.sessionId)) {
    return {
      continue: true,
      warnings: ['Ralph activation skipped because another exclusive mode is already active.'],
    };
  }

  const result = await executeRalphMode({
    cwd: context.cwd,
    prompt,
    task: context.task,
    sessionId: context.sessionId,
    workers: context.workers,
    maxIterations: (context.metadata?.maxIterations as number | undefined) ?? 3,
    metadata: context.metadata,
  }, deps);

  return {
    continue: true,
    activatedMode: MODE_NAMES.RALPH,
    message: result.summary,
    data: { result },
  };
}

export function createRalphHook(deps?: ModeExecutionDependencies): RegisteredHook {
  return {
    name: 'ralph',
    events: ['UserPromptSubmit'],
    priority: 49,
    handler: async (context) => processRalphHook(context, deps),
  };
}
