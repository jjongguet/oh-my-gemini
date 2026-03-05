import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { TeamStartInput } from '../team/types.js';
import { listCanonicalRoleSkillMappings } from '../team/role-skill-mapping.js';
import { formatInjectedHookContext } from './lifecycle-context.js';

function buildLifecycleHookPreview(params: {
  teamName: string;
  cwd: string;
  task: string;
  workers: number;
  stateRoot: string;
}): string {
  return formatInjectedHookContext({
    event: 'pre-tool',
    context: {
      teamName: params.teamName,
      cwd: params.cwd,
      task: params.task,
      workers: params.workers,
      stateRoot: params.stateRoot,
    },
    reason: 'tool=Edit',
    metadata: {
      hookEventName: 'PreToolUse',
      note: 'replace event/tool values at runtime (pre-tool|stop|cancel)',
    },
  });
}

export async function writeWorkerContext(input: TeamStartInput): Promise<void> {
  const geminiDir = path.join(input.cwd, '.gemini');
  const contextPath = path.join(geminiDir, 'GEMINI.md');
  const workers = input.workers ?? 1;

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

  const lifecyclePreview = buildLifecycleHookPreview({
    teamName: input.teamName,
    cwd: input.cwd,
    task: input.task,
    workers,
    stateRoot,
  });

  const content = [
    '# oh-my-gemini Team Context',
    '',
    `## Team: ${input.teamName}`,
    `## Task: ${input.task}`,
    `## Workers: ${workers}`,
    `## State Root: ${stateRoot}`,
    '',
    '## Environment Variables',
    '- `OMG_TEAM_WORKER`: `<teamName>/<workerId>` — combined identifier',
    '- `OMG_WORKER_NAME`: `<workerId>` — this worker\'s ID',
    '- `OMG_TEAM_STATE_ROOT`: path to `.omg/state/`',
    '- `OMG_WORKER_TASK_ID`: pre-assigned task ID for this worker (if set)',
    '- `OMG_WORKER_CLAIM_TOKEN`: claim token to use with transitionTaskStatus (if set)',
    '',
    '## Lifecycle Hooks',
    'OMC-style lifecycle hooks are available under `src/hooks/`:',
    '- `pre-tool`: executes before worker/runtime tool execution',
    '- `stop`: executes on operational stop/shutdown paths',
    '- `cancel`: executes on cancellation/failure paths',
    '',
    'Hook context injection example:',
    '```text',
    lifecyclePreview,
    '```',
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
    ...skillLines,
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
