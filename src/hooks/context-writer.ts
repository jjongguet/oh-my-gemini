import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { TeamStartInput } from '../team/types.js';
import { listCanonicalRoleSkillMappings } from '../team/role-skill-mapping.js';
import { loadDesignMd } from '../design/load-design-md.js';
import { buildDesignSection } from '../design/token-budget.js';
import { wrapDesignSection } from '../design/security.js';
import { detectUiTask, getDesignWarning } from '../design/smart-warning.js';
import { loadLearnedPatterns } from './learner/index.js';
import { formatProjectMemorySummary, loadProjectMemory } from './project-memory/index.js';

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
  learnedSkillLines: string[];
  projectMemorySummary?: string;
  designSection?: string;
}): string {
  const baseSections = [
    '# oh-my-product Team Context',
    '',
    `## Team: ${input.teamName}`,
    `## Task: ${truncateText(input.task, MAX_TASK_PREVIEW_CHARS)}`,
    `## Workers: ${input.workers}`,
    `## State Root: ${input.stateRoot}`,
    '',
    '## Environment Variables',
    '- `OMP_TEAM_WORKER`: `<teamName>/<workerId>` — combined identifier',
    '- `OMP_WORKER_NAME`: `<workerId>` — this worker\'s ID',
    '- `OMP_TEAM_STATE_ROOT`: path to `.omp/state/`',
    '- `OMP_WORKER_TASK_ID`: pre-assigned task ID for this worker (if set)',
    '- `OMP_WORKER_CLAIM_TOKEN`: claim token to use with transitionTaskStatus (if set)',
    '',
    '## Worker Done Signal Protocol',
    'Write a done signal file when your task is complete:',
    '  `$OMP_TEAM_STATE_ROOT/team/<teamName>/workers/<workerId>/done.json`',
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
    '## Learned Skills',
    ...(input.learnedSkillLines.length > 0 ? input.learnedSkillLines : ['- No learned skills recorded yet.']),
    ...(input.projectMemorySummary ? ['', input.projectMemorySummary] : []),
    '',
    'Use `omp skill list` to see all available skills.',
    'Use `omp skill <name>` to load a specific skill prompt.',
  ];

  const designLines = input.designSection ? ['', '## Design System', input.designSection] : [];
  const fullContent = [...baseSections, ...input.skillLines, ...designLines, ...footer].join('\n');
  if (Buffer.byteLength(fullContent, 'utf8') <= MAX_CONTEXT_BYTES) {
    return fullContent;
  }

  // Budget cascade: drop design section first (less critical than skill catalog)
  if (designLines.length > 0) {
    const withoutDesign = [...baseSections, ...input.skillLines, ...footer].join('\n');
    if (Buffer.byteLength(withoutDesign, 'utf8') <= MAX_CONTEXT_BYTES) {
      return withoutDesign;
    }
  }

  const compactContent = [
    ...baseSections,
    `- Skill catalog omitted because generated context exceeded ${MAX_CONTEXT_BYTES} bytes.`,
    '- Run `omp skill list` inside the worker session to inspect the full catalog.',
    ...footer,
  ].join('\n');

  if (Buffer.byteLength(compactContent, 'utf8') <= MAX_CONTEXT_BYTES) {
    return compactContent;
  }

  const emergencyTask = truncateText(input.task, 512);
  return [
    '# oh-my-product Team Context',
    '',
    `## Team: ${input.teamName}`,
    `## Task: ${emergencyTask}`,
    `## Workers: ${input.workers}`,
    `## State Root: ${input.stateRoot}`,
    '',
    'Context was compacted to avoid oversized worker context payloads.',
    'Use `omp skill list` and persisted team state for additional details.',
  ].join('\n');
}

export async function writeWorkerContext(input: TeamStartInput): Promise<void> {
  const geminiDir = path.join(input.cwd, '.gemini');
  const contextPath = path.join(geminiDir, 'GEMINI.md');

  const stateRoot =
    input.env?.OMP_TEAM_STATE_ROOT ??
    input.env?.OMX_TEAM_STATE_ROOT ??
    path.join(input.cwd, '.omp', 'state');

  const [projectMemory, learnedPatterns] = await Promise.all([
    loadProjectMemory(input.cwd),
    loadLearnedPatterns(input.cwd),
  ]);

  const skillMappings = listCanonicalRoleSkillMappings();
  const skillLines = skillMappings.map((mapping) => {
    const aliasList = mapping.aliases.length > 0
      ? `, ${mapping.aliases.join(', ')}`
      : '';
    const fallbackRoles = mapping.fallbackRoleIds.join(', ');

    return `- \`${mapping.skill}\` (/${mapping.skill}${aliasList}): primary role \`${mapping.primaryRoleId}\` (fallback: ${fallbackRoles})`;
  });

  const learnedSkillLines = learnedPatterns.slice(0, 5).map((pattern) => {
    const workersLabel = pattern.workers ? `, workers=${pattern.workers}` : '';
    return `- \`${pattern.id}\`: mode=\`${pattern.mode}\`${workersLabel} — ${pattern.summary ?? pattern.title}`;
  });

  // Design system integration (gated behind OMP_DESIGN_CONTEXT_ENABLED)
  let designSection: string | undefined;
  const designEnabled = input.env?.OMP_DESIGN_CONTEXT_ENABLED === '1' ||
    process.env['OMP_DESIGN_CONTEXT_ENABLED'] === '1';

  if (designEnabled) {
    try {
      const loaded = await loadDesignMd(input.cwd);
      if (loaded) {
        // Phase 2: default tier 1 (summary) for all workers
        const section = buildDesignSection(loaded.system, 1);
        designSection = wrapDesignSection(loaded.path, section);
      } else if (detectUiTask(input.task)) {
        // DESIGN.md absent + UI task → smart warning (logged, not injected)
        designSection = `\n${getDesignWarning()}\n`;
      }
    } catch {
      // Graceful degradation: design failure never interrupts workflow
    }
  }

  const content = buildContextContent({
    teamName: input.teamName,
    task: input.task,
    workers: input.workers ?? 1,
    stateRoot,
    skillLines,
    learnedSkillLines,
    projectMemorySummary: formatProjectMemorySummary(projectMemory),
    designSection,
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
