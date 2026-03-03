import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { TeamStartInput } from '../team/types.js';

export async function writeWorkerContext(input: TeamStartInput): Promise<void> {
  const geminiDir = path.join(input.cwd, '.gemini');
  const contextPath = path.join(geminiDir, 'GEMINI.md');

  const stateRoot =
    input.env?.OMG_TEAM_STATE_ROOT ??
    input.env?.OMX_TEAM_STATE_ROOT ??
    path.join(input.cwd, '.omg', 'state');

  const content = [
    '# oh-my-gemini Team Context',
    '',
    `## Team: ${input.teamName}`,
    `## Task: ${input.task}`,
    `## Workers: ${input.workers ?? 1}`,
    `## State Root: ${stateRoot}`,
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
    '- `plan` (/plan): Produce a phased execution plan aligned to the oh-my-gemini roadmap gates.',
    '- `team` (/team, team run): Orchestrate parallel tmux workers for a multi-agent team task.',
    '- `review` (/review): Perform a structured code review of recent changes or a specific scope.',
    '- `verify` (/verify): Verify that acceptance criteria are met and work is complete.',
    '- `handoff` (/handoff): Produce a structured handoff document summarizing completed work and next steps.',
    '',
    'Use `omg skill list` to see all available skills.',
    'Use `omg skill <name>` to load a specific skill prompt.',
  ].join('\n');

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
