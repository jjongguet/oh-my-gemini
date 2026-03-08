import path from 'node:path';

import { atomicWriteJson } from '../../lib/atomic-write.js';
import { getOmcRoot } from '../../lib/worktree-paths.js';
import { appendNdjsonFile, readJsonFile } from '../../state/filesystem.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';

export interface TrackedAgentRecord {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed';
  teamName?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  summary?: string;
}

export interface SubagentTrackingState {
  schemaVersion: 1;
  updatedAt: string;
  agents: Record<string, TrackedAgentRecord>;
}

function createEmptyState(): SubagentTrackingState {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    agents: {},
  };
}

function getTrackerStatePath(cwd: string): string {
  return path.join(getOmcRoot(cwd), 'state', 'subagent-tracker.json');
}

function getTrackerEventsPath(cwd: string): string {
  return path.join(getOmcRoot(cwd), 'state', 'subagent-tracker.ndjson');
}

export async function readTrackingState(cwd: string): Promise<SubagentTrackingState> {
  return (await readJsonFile<SubagentTrackingState>(getTrackerStatePath(cwd))) ?? createEmptyState();
}

export async function writeTrackingState(cwd: string, state: SubagentTrackingState): Promise<void> {
  await atomicWriteJson(getTrackerStatePath(cwd), {
    ...state,
    updatedAt: new Date().toISOString(),
  });
}

export async function processSubagentStart(params: {
  cwd: string;
  id: string;
  type: string;
  teamName?: string;
}): Promise<TrackedAgentRecord> {
  const state = await readTrackingState(params.cwd);
  const now = new Date().toISOString();
  const record: TrackedAgentRecord = {
    id: params.id,
    type: params.type,
    teamName: params.teamName,
    status: 'running',
    startedAt: state.agents[params.id]?.startedAt ?? now,
    updatedAt: now,
  };
  state.agents[params.id] = record;
  await writeTrackingState(params.cwd, state);
  await appendNdjsonFile(getTrackerEventsPath(params.cwd), { event: 'start', at: now, agent: record });
  return record;
}

export async function processSubagentStop(params: {
  cwd: string;
  id: string;
  status: 'completed' | 'failed';
  summary?: string;
}): Promise<TrackedAgentRecord | null> {
  const state = await readTrackingState(params.cwd);
  const existing = state.agents[params.id];
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: TrackedAgentRecord = {
    ...existing,
    status: params.status,
    updatedAt: now,
    completedAt: now,
    summary: params.summary ?? existing.summary,
  };
  state.agents[params.id] = updated;
  await writeTrackingState(params.cwd, state);
  await appendNdjsonFile(getTrackerEventsPath(params.cwd), { event: 'stop', at: now, agent: updated });
  return updated;
}

export async function getTrackingStats(cwd: string): Promise<{ total: number; running: number; completed: number; failed: number }> {
  const state = await readTrackingState(cwd);
  const agents = Object.values(state.agents);
  return {
    total: agents.length,
    running: agents.filter((agent) => agent.status === 'running').length,
    completed: agents.filter((agent) => agent.status === 'completed').length,
    failed: agents.filter((agent) => agent.status === 'failed').length,
  };
}

export async function processSubagentTrackerHook(context: HookContext): Promise<HookResult> {
  return {
    continue: true,
    data: { stats: await getTrackingStats(context.cwd) },
  };
}

export function createSubagentTrackerHook(): RegisteredHook {
  return {
    name: 'subagent-tracker',
    events: ['SessionStart', 'SessionEnd', 'PostToolUse'],
    priority: 30,
    handler: processSubagentTrackerHook,
  };
}
