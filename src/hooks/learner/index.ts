import { promises as fs } from 'node:fs';
import path from 'node:path';

import { atomicWriteJson } from '../../lib/atomic-write.js';
import { getOmcRoot } from '../../lib/worktree-paths.js';
import type { TeamRunResult } from '../../team/types.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';
import { extractPromptText } from '../keyword-detector/index.js';

const LEARNED_SKILLS_DIRNAME = 'learned-skills';
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'build', 'make', 'need', 'want',
  'please', 'mode', 'task', 'team', 'worker', 'autopilot', 'ralph', 'ultrawork', 'fix', 'add',
]);

export interface LearnedSkillPattern {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: string;
  title: string;
  prompt: string;
  tokens: string[];
  successCount: number;
  usageCount: number;
  backend?: string;
  workers?: number;
  summary?: string;
}

export interface LearnedSkillMatch {
  pattern: LearnedSkillPattern;
  score: number;
}

function createSkillId(mode: string, tokens: string[]): string {
  const suffix = tokens.slice(0, 4).join('-') || 'pattern';
  return `${mode}-${suffix}`.slice(0, 96);
}

function uniqueTokens(prompt: string): string[] {
  const cleaned = extractPromptText(prompt)
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));

  return [...new Set(cleaned)].slice(0, 12);
}

export function getLearnedSkillsDir(cwd: string): string {
  return path.join(getOmcRoot(cwd), LEARNED_SKILLS_DIRNAME);
}

export async function loadLearnedPatterns(cwd: string): Promise<LearnedSkillPattern[]> {
  const dir = getLearnedSkillsDir(cwd);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    const patterns = await Promise.all(files.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const raw = await fs.readFile(fullPath, 'utf8');
      return JSON.parse(raw) as LearnedSkillPattern;
    }));

    return patterns.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function storeLearnedPattern(cwd: string, pattern: LearnedSkillPattern): Promise<LearnedSkillPattern> {
  const dir = getLearnedSkillsDir(cwd);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `${pattern.id}.json`);
  const existing = (await loadLearnedPatterns(cwd)).find((entry) => entry.id === pattern.id);
  const merged: LearnedSkillPattern = existing
    ? {
        ...existing,
        ...pattern,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        successCount: existing.successCount + pattern.successCount,
      }
    : pattern;

  await atomicWriteJson(target, merged);
  return merged;
}

export async function recordSuccessfulCompletion(params: {
  cwd: string;
  mode: string;
  prompt: string;
  result: TeamRunResult;
  workers?: number;
}): Promise<LearnedSkillPattern | null> {
  if (!params.result.success) {
    return null;
  }

  const tokens = uniqueTokens(params.prompt);
  const createdAt = new Date().toISOString();
  const pattern: LearnedSkillPattern = {
    schemaVersion: 1,
    id: createSkillId(params.mode, tokens),
    createdAt,
    updatedAt: createdAt,
    mode: params.mode,
    title: `${params.mode} pattern for ${tokens.slice(0, 3).join(', ') || 'task automation'}`,
    prompt: params.prompt.trim(),
    tokens,
    successCount: 1,
    usageCount: 0,
    backend: params.result.backend,
    workers: params.workers,
    summary: params.result.snapshot?.summary,
  };

  return storeLearnedPattern(params.cwd, pattern);
}

export async function findMatchingLearnedPatterns(cwd: string, prompt: string): Promise<LearnedSkillMatch[]> {
  const requested = uniqueTokens(prompt);
  if (requested.length === 0) {
    return [];
  }

  const patterns = await loadLearnedPatterns(cwd);
  return patterns
    .map((pattern) => {
      const overlap = pattern.tokens.filter((token) => requested.includes(token)).length;
      const score = overlap / Math.max(requested.length, pattern.tokens.length, 1);
      return { pattern, score };
    })
    .filter((entry) => entry.score >= 0.25)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

export async function replayLearnedPattern<T>(params: {
  pattern: LearnedSkillPattern;
  request: { cwd: string; prompt: string; sessionId?: string };
  replay: (payload: { pattern: LearnedSkillPattern; cwd: string; prompt: string; sessionId?: string }) => Promise<T>;
}): Promise<T> {
  const result = await params.replay({
    pattern: params.pattern,
    cwd: params.request.cwd,
    prompt: params.request.prompt,
    sessionId: params.request.sessionId,
  });

  await storeLearnedPattern(params.request.cwd, {
    ...params.pattern,
    usageCount: params.pattern.usageCount + 1,
    updatedAt: new Date().toISOString(),
  });

  return result;
}

export async function processLearnerHook(context: HookContext): Promise<HookResult> {
  const prompt = context.prompt ?? context.task ?? '';
  const matches = await findMatchingLearnedPatterns(context.cwd, prompt);
  return {
    continue: true,
    message: matches.length > 0
      ? `Learned patterns available: ${matches.map((entry) => `${entry.pattern.id} (${entry.score.toFixed(2)})`).join(', ')}`
      : 'No learned patterns matched this task yet.',
    data: { matches },
  };
}

export function createLearnerHook(): RegisteredHook {
  return {
    name: 'learner',
    events: ['UserPromptSubmit', 'SessionEnd'],
    priority: 10,
    handler: processLearnerHook,
  };
}
