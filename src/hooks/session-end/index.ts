import path from 'node:path';

import { SESSION_END_MODE_STATE_FILES } from '../../lib/mode-names.js';
import { clearModeStateFile, readModeState } from '../../lib/mode-state-io.js';
import { getSessionStateDir, getOmcRoot } from '../../lib/worktree-paths.js';
import { writeJsonFile } from '../../state/filesystem.js';
import { loadLearnedPatterns } from '../learner/index.js';
import { loadProjectMemory } from '../project-memory/index.js';
import { getTrackingStats } from '../subagent-tracker/index.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';

export interface SessionSummary {
  sessionId?: string;
  endedAt: string;
  activeModes: string[];
  learnedSkillCount: number;
  trackedAgents: Awaited<ReturnType<typeof getTrackingStats>>;
  recentTasks: string[];
}

export async function exportSessionSummary(context: HookContext): Promise<SessionSummary> {
  const activeModes = SESSION_END_MODE_STATE_FILES
    .map((entry) => entry.mode)
    .filter((mode) => readModeState(mode, context.cwd, context.sessionId) !== null);
  const [patterns, memory, trackedAgents] = await Promise.all([
    loadLearnedPatterns(context.cwd),
    loadProjectMemory(context.cwd),
    getTrackingStats(context.cwd),
  ]);

  const summary: SessionSummary = {
    sessionId: context.sessionId,
    endedAt: new Date().toISOString(),
    activeModes,
    learnedSkillCount: patterns.length,
    trackedAgents,
    recentTasks: memory.recentTasks.slice(0, 5).map((task) => task.task),
  };

  const summaryDir = context.sessionId
    ? getSessionStateDir(context.sessionId, context.cwd)
    : path.join(getOmcRoot(context.cwd), 'state', 'sessions');
  await writeJsonFile(path.join(summaryDir, 'summary.json'), summary);
  return summary;
}

export async function cleanupTransientState(context: HookContext): Promise<void> {
  await Promise.all(
    SESSION_END_MODE_STATE_FILES.map(async (entry) => {
      clearModeStateFile(entry.mode, context.cwd, context.sessionId);
    }),
  );
}

export async function processSessionEnd(context: HookContext): Promise<HookResult> {
  const summary = await exportSessionSummary(context);
  await cleanupTransientState(context);
  return {
    continue: true,
    message: `Session summary exported with ${summary.activeModes.length} active mode(s).`,
    data: { summary },
  };
}

export function createSessionEndHook(): RegisteredHook {
  return {
    name: 'session-end',
    events: ['SessionEnd', 'Stop'],
    priority: 90,
    handler: processSessionEnd,
  };
}
