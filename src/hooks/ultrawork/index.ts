import { MODE_NAMES } from '../../lib/mode-names.js';
import { executeUltraworkMode } from '../../modes/ultrawork.js';
import type { ModeExecutionDependencies } from '../../modes/types.js';
import { canStartMode } from '../mode-registry/index.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';
import { routePromptToMode } from '../keyword-detector/index.js';

export function shouldActivateUltrawork(prompt: string): boolean {
  return routePromptToMode(prompt).mode === MODE_NAMES.ULTRAWORK;
}

export async function processUltraworkHook(
  context: HookContext,
  deps?: ModeExecutionDependencies,
): Promise<HookResult> {
  const prompt = context.prompt ?? context.task ?? '';
  if (!shouldActivateUltrawork(prompt)) {
    return { continue: true, message: 'Ultrawork hook did not activate.' };
  }

  if (!canStartMode(MODE_NAMES.ULTRAWORK, context.cwd, context.sessionId)) {
    return {
      continue: true,
      warnings: ['Ultrawork activation skipped because another exclusive mode is already active.'],
    };
  }

  const result = await executeUltraworkMode({
    cwd: context.cwd,
    prompt,
    task: context.task,
    sessionId: context.sessionId,
    workers: context.workers,
    metadata: context.metadata,
  }, deps);

  return {
    continue: true,
    activatedMode: MODE_NAMES.ULTRAWORK,
    message: result.summary,
    data: { result },
  };
}

export function createUltraworkHook(deps?: ModeExecutionDependencies): RegisteredHook {
  return {
    name: 'ultrawork',
    events: ['UserPromptSubmit'],
    priority: 48,
    handler: async (context) => processUltraworkHook(context, deps),
  };
}
