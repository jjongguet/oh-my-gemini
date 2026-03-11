import path from 'node:path';

import { getWorktreeProjectMemoryPath } from '../../lib/worktree-paths.js';
import { readJsonFile, writeJsonFile } from '../../state/filesystem.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';

export interface ProjectTaskMemory {
  task: string;
  mode?: string;
  at: string;
}

export interface ProjectMemoryRecord {
  schemaVersion: 1;
  updatedAt: string;
  directives: string[];
  notes: string[];
  hotPaths: string[];
  recentTasks: ProjectTaskMemory[];
  learnedSkillIds: string[];
}

function createEmptyMemory(): ProjectMemoryRecord {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    directives: [],
    notes: [],
    hotPaths: [],
    recentTasks: [],
    learnedSkillIds: [],
  };
}

export async function loadProjectMemory(cwd: string): Promise<ProjectMemoryRecord> {
  const filePath = getWorktreeProjectMemoryPath(cwd);
  return (await readJsonFile<ProjectMemoryRecord>(filePath)) ?? createEmptyMemory();
}

export async function saveProjectMemory(cwd: string, memory: ProjectMemoryRecord): Promise<void> {
  const filePath = getWorktreeProjectMemoryPath(cwd);
  await writeJsonFile(filePath, {
    ...memory,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateProjectMemory(
  cwd: string,
  updater: (memory: ProjectMemoryRecord) => ProjectMemoryRecord | Promise<ProjectMemoryRecord>,
): Promise<ProjectMemoryRecord> {
  const next = await updater(await loadProjectMemory(cwd));
  await saveProjectMemory(cwd, next);
  return next;
}

export async function recordProjectMemoryTask(params: {
  cwd: string;
  task: string;
  mode?: string;
  learnedSkillId?: string;
}): Promise<ProjectMemoryRecord> {
  return updateProjectMemory(params.cwd, (memory) => ({
    ...memory,
    recentTasks: [
      { task: params.task.trim(), mode: params.mode, at: new Date().toISOString() },
      ...memory.recentTasks,
    ].slice(0, 12),
    learnedSkillIds: params.learnedSkillId
      ? [params.learnedSkillId, ...memory.learnedSkillIds.filter((id) => id !== params.learnedSkillId)].slice(0, 12)
      : memory.learnedSkillIds,
  }));
}

export function formatProjectMemorySummary(memory: ProjectMemoryRecord): string {
  const directives = memory.directives.slice(0, 3).map((value) => `- ${value}`);
  const tasks = memory.recentTasks.slice(0, 3).map((task) => {
    const modeLabel = task.mode ? ` (${task.mode})` : '';
    return `- ${task.task}${modeLabel}`;
  });
  const hotPaths = memory.hotPaths.slice(0, 3).map((value) => `- ${value}`);

  return [
    '## Project Memory',
    directives.length > 0 ? ['### Directives', ...directives].join('\n') : '### Directives\n- none recorded',
    tasks.length > 0 ? ['### Recent Tasks', ...tasks].join('\n') : '### Recent Tasks\n- none recorded',
    hotPaths.length > 0 ? ['### Hot Paths', ...hotPaths].join('\n') : '### Hot Paths\n- none recorded',
  ].join('\n\n');
}

export async function processProjectMemoryHook(context: HookContext): Promise<HookResult> {
  const memory = await loadProjectMemory(context.cwd);
  return {
    continue: true,
    systemMessage: formatProjectMemorySummary(memory),
    data: { memory },
  };
}

export function createProjectMemoryHook(): RegisteredHook {
  return {
    name: 'project-memory',
    events: ['SessionStart', 'UserPromptSubmit', 'PreCompact'],
    priority: 5,
    handler: processProjectMemoryHook,
  };
}

export function getProjectMemoryDirectory(cwd: string): string {
  return path.dirname(getWorktreeProjectMemoryPath(cwd));
}
