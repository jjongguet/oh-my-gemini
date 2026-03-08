import { MODE_NAMES } from '../../lib/mode-names.js';
import { executeAutopilotMode } from '../../modes/autopilot.js';
import type { ModeExecutionDependencies } from '../../modes/types.js';
import { canStartMode } from '../mode-registry/index.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';
import { routePromptToMode } from '../keyword-detector/index.js';

export function shouldActivateAutopilot(prompt: string): boolean {
  return routePromptToMode(prompt).mode === MODE_NAMES.AUTOPILOT;
}

export async function processAutopilotHook(
  context: HookContext,
  deps?: ModeExecutionDependencies,
): Promise<HookResult> {
  const prompt = context.prompt ?? context.task ?? '';
  if (!shouldActivateAutopilot(prompt)) {
    return { continue: true, message: 'Autopilot hook did not activate.' };
  }

  if (!canStartMode(MODE_NAMES.AUTOPILOT, context.cwd, context.sessionId)) {
    return {
      continue: true,
      warnings: ['Autopilot activation skipped because another exclusive mode is already active.'],
    };
  }

  const result = await executeAutopilotMode({
    cwd: context.cwd,
    prompt,
    task: context.task,
    sessionId: context.sessionId,
    workers: context.workers,
    metadata: context.metadata,
  }, deps);

  return {
    continue: true,
    activatedMode: MODE_NAMES.AUTOPILOT,
    message: result.summary,
    data: { result },
  };
}

export function createAutopilotHook(deps?: ModeExecutionDependencies): RegisteredHook {
  return {
    name: 'autopilot',
    events: ['UserPromptSubmit'],
    priority: 50,
    handler: async (context) => processAutopilotHook(context, deps),
  };
}
