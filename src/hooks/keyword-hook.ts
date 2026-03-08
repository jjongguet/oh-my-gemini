import { routePromptToMode } from './keyword-detector/index.js';
import type { HookContext, HookResult, RegisteredHook } from './types.js';

export async function processKeywordDetectorHook(context: HookContext): Promise<HookResult> {
  const prompt = context.prompt ?? context.task ?? '';
  const route = routePromptToMode(prompt);
  return {
    continue: true,
    activatedMode: route.mode,
    data: { route },
    message: route.mode ? `Keyword detector routed prompt to ${route.mode}.` : 'Keyword detector found no execution-mode route.',
  };
}

export function createKeywordDetectorHook(): RegisteredHook {
  return {
    name: 'keyword-detector',
    events: ['UserPromptSubmit'],
    priority: 45,
    handler: processKeywordDetectorHook,
  };
}
