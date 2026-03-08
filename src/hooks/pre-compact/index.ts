import path from 'node:path';

import { MODE_NAMES } from '../../lib/mode-names.js';
import { readModeState } from '../../lib/mode-state-io.js';
import { getOmcRoot } from '../../lib/worktree-paths.js';
import { writeJsonFile } from '../../state/filesystem.js';
import { loadLearnedPatterns } from '../learner/index.js';
import { loadProjectMemory } from '../project-memory/index.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';

export interface CompactCheckpoint {
  createdAt: string;
  sessionId?: string;
  activeModes: string[];
  learnedSkillCount: number;
  recentTasks: string[];
}

export async function createCompactCheckpoint(context: HookContext): Promise<CompactCheckpoint> {
  const activeModes = [MODE_NAMES.AUTOPILOT, MODE_NAMES.RALPH, MODE_NAMES.ULTRAWORK]
    .filter((mode) => readModeState(mode, context.cwd, context.sessionId) !== null);
  const [patterns, memory] = await Promise.all([
    loadLearnedPatterns(context.cwd),
    loadProjectMemory(context.cwd),
  ]);

  return {
    createdAt: new Date().toISOString(),
    sessionId: context.sessionId,
    activeModes,
    learnedSkillCount: patterns.length,
    recentTasks: memory.recentTasks.slice(0, 5).map((task) => task.task),
  };
}

export function formatCompactSummary(checkpoint: CompactCheckpoint): string {
  return [
    '## Pre-compact checkpoint',
    `- active modes: ${checkpoint.activeModes.join(', ') || 'none'}`,
    `- learned skills: ${checkpoint.learnedSkillCount}`,
    `- recent tasks: ${checkpoint.recentTasks.join(' | ') || 'none'}`,
  ].join('\n');
}

export async function processPreCompact(context: HookContext): Promise<HookResult> {
  const checkpoint = await createCompactCheckpoint(context);
  const target = path.join(getOmcRoot(context.cwd), 'state', 'checkpoints', `${Date.now()}-checkpoint.json`);
  await writeJsonFile(target, checkpoint);
  return {
    continue: true,
    systemMessage: formatCompactSummary(checkpoint),
    data: { checkpoint, checkpointPath: target },
  };
}

export function createPreCompactHook(): RegisteredHook {
  return {
    name: 'pre-compact',
    events: ['PreCompact'],
    priority: 40,
    handler: processPreCompact,
  };
}
