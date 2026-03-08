import { createAutopilotHook } from './autopilot/index.js';
import { readTeamContext } from './context-reader.js';
import { writeWorkerContext } from './context-writer.js';
import { createKeywordDetectorHook } from './keyword-hook.js';
import { createLearnerHook } from './learner/index.js';
import { createModeRegistryHook } from './mode-registry/index.js';
import { createPermissionHandlerHook } from './permission-handler/index.js';
import { createPreCompactHook } from './pre-compact/index.js';
import { createProjectMemoryHook } from './project-memory/index.js';
import { createRalphHook } from './ralph/index.js';
import { createRecoveryHook } from './recovery-hook.js';
import { createSessionEndHook } from './session-end/index.js';
import { createSubagentTrackerHook } from './subagent-tracker/index.js';
import type { HookContext, HookResult, RegisteredHook } from './types.js';
import { createUltraworkHook } from './ultrawork/index.js';

export { readTeamContext } from './context-reader.js';
export { writeWorkerContext } from './context-writer.js';
export * from './types.js';
export * from './keyword-detector/index.js';
export * from './autopilot/index.js';
export * from './ralph/index.js';
export * from './ultrawork/index.js';
export * from './mode-registry/index.js';
export * from './session-end/index.js';
export * from './recovery/index.js';
export * from './permission-handler/index.js';
export * from './learner/index.js';
export * from './project-memory/index.js';
export * from './subagent-tracker/index.js';
export * from './pre-compact/index.js';
export * from './keyword-hook.js';
export * from './recovery-hook.js';

export function mergeHookResults(results: HookResult[]): HookResult {
  return results.reduce<HookResult>((accumulator, result) => ({
    continue: accumulator.continue && result.continue,
    message: [accumulator.message, result.message].filter(Boolean).join('\n') || undefined,
    systemMessage: [accumulator.systemMessage, result.systemMessage].filter(Boolean).join('\n\n') || undefined,
    activatedMode: result.activatedMode ?? accumulator.activatedMode,
    reroutedTask: result.reroutedTask ?? accumulator.reroutedTask,
    warnings: [...(accumulator.warnings ?? []), ...(result.warnings ?? [])],
    data: { ...(accumulator.data ?? {}), ...(result.data ?? {}) },
  }), { continue: true });
}

export async function runHookPipeline(context: HookContext, hooks: readonly RegisteredHook[]): Promise<HookResult[]> {
  const event = context.event;
  const applicable = hooks
    .filter((hook) => !event || hook.events.includes(event))
    .sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100));

  const results: HookResult[] = [];
  for (const hook of applicable) {
    results.push(await hook.handler(context));
  }
  return results;
}

export function createDefaultHookRegistry(): RegisteredHook[] {
  return [
    createModeRegistryHook(),
    createProjectMemoryHook(),
    createLearnerHook(),
    createPermissionHandlerHook(),
    createRecoveryHook(),
    createSubagentTrackerHook(),
    createAutopilotHook(),
    createRalphHook(),
    createUltraworkHook(),
    createPreCompactHook(),
    createSessionEndHook(),
    createKeywordDetectorHook(),
  ];
}
