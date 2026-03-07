import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { TeamStartInput } from '../team/types.js';
import { listCanonicalRoleSkillMappings } from '../team/role-skill-mapping.js';

const MAX_CONTEXT_BYTES = 16 * 1024;
const MAX_TASK_PREVIEW_CHARS = 2_000;

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxChars - 15)).trimEnd()}… [truncated]`;
}

function buildContextContent(input: {
  teamName: string;
  task: string;
  workers: number;
  stateRoot: string;
  skillLines: string[];
}): string {
  const baseSections = [
    '# oh-my-gemini Team Context',
    '',
    `## Team: ${input.teamName}`,
    `## Task: ${truncateText(input.task, MAX_TASK_PREVIEW_CHARS)}`,
    `## Workers: ${input.workers}`,
    `## State Root: ${input.stateRoot}`,
    '',
    '## Environment Variables',
    '- `OMG_TEAM_WORKER`: `<teamName>/<workerId>` — combined identifier',
    '- `OMG_WORKER_NAME`: `<workerId>` — this worker\'s ID',
    '- `OMG_TEAM_STATE_ROOT`: path to `.omg/state/`',
    '- `OMG_WORKER_TASK_ID`: pre-assigned task ID for this worker (if set)',
    '- `OMG_WORKER_CLAIM_TOKEN`: claim token to use with transitionTaskStatus (if set)',
    '',
    '## Worker Done Signal Protocol',
    'Write a done signal file when your task is complete:',
    '  `$OMG_TEAM_STATE_ROOT/team/<teamName>/workers/<workerId>/done.json`',
    '',
    'Done signal format:',
    '```json',
    '{',
    '  "teamName": "<teamName>",',
    '  "workerName": "<workerId>",',
    '  "status": "completed",',
    '  "completedAt": "<ISO-8601 timestamp>",',
    '  "summary": "<optional summary of work done>"',
    '}',
    '```',
    '',
    '## Available Skills',
    'Workers can leverage these skills through SKILL.md extension files:',
  ];

  const footer = [
    '',
    'Use `omg skill list` to see all available skills.',
    'Use `omg skill <name>` to load a specific skill prompt.',
  ];

  const fullContent = [...baseSections, ...input.skillLines, ...footer].join('\n');
  if (Buffer.byteLength(fullContent, 'utf8') <= MAX_CONTEXT_BYTES) {
    return fullContent;
  }

  const compactContent = [
    ...baseSections,
    `- Skill catalog omitted because generated context exceeded ${MAX_CONTEXT_BYTES} bytes.`,
    '- Run `omg skill list` inside the worker session to inspect the full catalog.',
    ...footer,
  ].join('\n');

  if (Buffer.byteLength(compactContent, 'utf8') <= MAX_CONTEXT_BYTES) {
    return compactContent;
  }

  const emergencyTask = truncateText(input.task, 512);
  return [
    '# oh-my-gemini Team Context',
    '',
    `## Team: ${input.teamName}`,
    `## Task: ${emergencyTask}`,
    `## Workers: ${input.workers}`,
    `## State Root: ${input.stateRoot}`,
    '',
    'Context was compacted to avoid oversized worker context payloads.',
    'Use `omg skill list` and persisted team state for additional details.',
  ].join('\n');
}

export async function writeWorkerContext(input: TeamStartInput): Promise<void> {
  const geminiDir = path.join(input.cwd, '.gemini');
  const contextPath = path.join(geminiDir, 'GEMINI.md');

  const stateRoot =
    input.env?.OMG_TEAM_STATE_ROOT ??
    input.env?.OMX_TEAM_STATE_ROOT ??
    path.join(input.cwd, '.omg', 'state');

  const skillMappings = listCanonicalRoleSkillMappings();
  const skillLines = skillMappings.map((mapping) => {
    const aliasList = mapping.aliases.length > 0
      ? `, ${mapping.aliases.join(', ')}`
      : '';
    const fallbackRoles = mapping.fallbackRoleIds.join(', ');

    return `- \`${mapping.skill}\` (/${mapping.skill}${aliasList}): primary role \`${mapping.primaryRoleId}\` (fallback: ${fallbackRoles})`;
  });

  const content = buildContextContent({
    teamName: input.teamName,
    task: input.task,
    workers: input.workers ?? 1,
    stateRoot,
    skillLines,
  });

  await mkdir(geminiDir, { recursive: true });
  try {
    await writeFile(contextPath, content, 'utf8');
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    throw new Error(
      `Failed to write team context to ${contextPath}: ${nodeErr.code ?? nodeErr.message}`,
    );
  }
}
