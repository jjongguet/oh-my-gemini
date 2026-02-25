import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';

import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export type TeamBackend = 'tmux' | 'subagents';

export interface TeamRunInput {
  teamName: string;
  task: string;
  backend: TeamBackend;
  subagents?: string[];
  maxFixLoop: number;
  watchdogMs?: number;
  nonReportingMs?: number;
  dryRun: boolean;
  cwd: string;
}

export interface TeamRunOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface TeamRunCommandContext {
  io: CliIo;
  cwd: string;
  teamRunner?: (input: TeamRunInput) => Promise<TeamRunOutput>;
}

interface ParsedTaskKeywords {
  cleanedTask: string;
  subagents: string[];
  requestedSubagentsBackend: boolean;
}

const SUBAGENTS_BACKEND_KEYWORDS = new Set([
  'subagents',
  'subagent',
  'agents',
]);
const SUBAGENT_KEYWORD_TOKEN_PATTERN = /^([/$])([a-zA-Z0-9][a-zA-Z0-9._-]*)$/;

function printTeamRunHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg team run --task "<description>" [--team <name>] [--backend tmux|subagents] [--subagents <ids>] [--max-fix-loop <n>] [--dry-run] [--json]',
    '',
    'Options:',
    '  --task <text>        Required task description for orchestration',
    '  --team <name>        Team state namespace (default: oh-my-gemini)',
    '  --backend <name>     Runtime backend (default: tmux)',
    '  --subagents <ids>    Comma-separated subagent ids (subagents backend only)',
    '  --max-fix-loop <n>   Max fix attempts before fail (default: 1)',
    '  --watchdog-ms <n>    Snapshot watchdog threshold in milliseconds (optional)',
    '  --non-reporting-ms <n>  Worker heartbeat staleness threshold in milliseconds (optional)',
    '  --dry-run            Validate and print planned run without executing',
    '  --json               Print machine-readable output',
    '  --help               Show command help',
    '',
    'Keyword shortcuts:',
    '  Prefix the task with subagent tags to auto-assign roles on subagents backend.',
    '  Example: --task "$planner /executor implement onboarding flow"',
    '  Tags are parsed only at the beginning of the task text.',
  ].join('\n'));
}

function isTeamBackend(value: string | undefined): value is TeamBackend {
  return value === 'tmux' || value === 'subagents';
}

function parseNumberOption(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, received: ${raw}`);
  }

  return parsed;
}

function parsePositiveNumberOption(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, received: ${raw}`);
  }

  return parsed;
}

function normalizeTeamName(raw: string | undefined): string {
  const source = raw?.trim() || 'oh-my-gemini';
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'oh-my-gemini';
}

function parseSubagentList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = raw.split(',');

  return dedupeSubagentIds(parsed, {
    emptyError:
      'Expected at least one comma-separated subagent id for --subagents.',
  });
}

function dedupeSubagentIds(
  values: string[],
  options?: {
    emptyError?: string;
  },
): string[] {
  const normalized = values
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) {
    if (options?.emptyError) {
      throw new Error(options.emptyError);
    }
    return [];
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const subagent of normalized) {
    if (seen.has(subagent)) {
      continue;
    }
    seen.add(subagent);
    deduped.push(subagent);
  }

  return deduped;
}

function extractLeadingSubagentKeywords(task: string): ParsedTaskKeywords {
  const trimmed = task.trim();
  if (!trimmed) {
    return {
      cleanedTask: '',
      subagents: [],
      requestedSubagentsBackend: false,
    };
  }

  const tokens = trimmed.split(/\s+/);
  const keywordTokens: string[] = [];
  const assignments: string[] = [];
  let requestedSubagentsBackend = false;

  for (const token of tokens) {
    const match = token.match(SUBAGENT_KEYWORD_TOKEN_PATTERN);
    if (!match) {
      break;
    }

    keywordTokens.push(token);

    const keywordId = (match[2] ?? '').toLowerCase();
    if (!keywordId) {
      break;
    }
    if (SUBAGENTS_BACKEND_KEYWORDS.has(keywordId)) {
      requestedSubagentsBackend = true;
      continue;
    }

    assignments.push(keywordId);
  }

  if (keywordTokens.length === 0) {
    return {
      cleanedTask: trimmed,
      subagents: [],
      requestedSubagentsBackend: false,
    };
  }

  const cleanedTask = tokens.slice(keywordTokens.length).join(' ').trim();

  return {
    cleanedTask,
    subagents: dedupeSubagentIds(assignments),
    requestedSubagentsBackend,
  };
}

function mergeSubagentSelection(
  optionSubagents: string[] | undefined,
  keywordSubagents: string[],
): string[] | undefined {
  if ((!optionSubagents || optionSubagents.length === 0) && keywordSubagents.length === 0) {
    return undefined;
  }

  return dedupeSubagentIds([
    ...(optionSubagents ?? []),
    ...keywordSubagents,
  ]);
}

async function defaultTeamRunner(input: TeamRunInput): Promise<TeamRunOutput> {
  if (input.dryRun) {
    return {
      exitCode: 0,
      message: 'Dry run passed. Team runtime invocation validated.',
      details: {
        teamName: input.teamName,
        backend: input.backend,
        task: input.task,
        subagents: input.subagents,
        maxFixLoop: input.maxFixLoop,
        watchdogMs: input.watchdogMs,
        nonReportingMs: input.nonReportingMs,
      },
    };
  }

  const { TeamOrchestrator } = await import('../../team/team-orchestrator.js');
  const orchestrator = new TeamOrchestrator();

  const runResult = await orchestrator.run({
    teamName: input.teamName,
    task: input.task,
    cwd: input.cwd,
    backend: input.backend,
    subagents: input.subagents,
    maxFixAttempts: input.maxFixLoop,
    watchdogMs: input.watchdogMs,
    nonReportingMs: input.nonReportingMs,
    metadata: {
      invokedBy: 'omg team run',
    },
  });

  if (runResult.handle) {
    await orchestrator.shutdown(runResult.handle, true).catch(() => undefined);
  }

  const phaseFilePath = path.join(
    input.cwd,
    '.omg',
    'state',
    'team',
    input.teamName,
    'phase.json',
  );

  if (runResult.success) {
    return {
      exitCode: 0,
      message: `Team run completed with backend "${runResult.backend}" (phase=${runResult.phase}).`,
      details: {
        teamName: input.teamName,
        backend: runResult.backend,
        phase: runResult.phase,
        attempts: runResult.attempts,
        subagents: input.subagents,
        watchdogMs: input.watchdogMs,
        nonReportingMs: input.nonReportingMs,
        phaseFilePath,
      },
    };
  }

  return {
    exitCode: 1,
    message: runResult.error
      ? `Team run failed: ${runResult.error}`
      : `Team run failed in phase "${runResult.phase}".`,
    details: {
      teamName: input.teamName,
      backend: runResult.backend,
      task: input.task,
      phase: runResult.phase,
      attempts: runResult.attempts,
      subagents: input.subagents,
      watchdogMs: input.watchdogMs,
      nonReportingMs: input.nonReportingMs,
      issues: runResult.issues,
      phaseFilePath,
    },
  };
}

export async function executeTeamRunCommand(
  argv: string[],
  context: TeamRunCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printTeamRunHelp(io);
    return { exitCode: 0 };
  }

  const rawTask = getStringOption(parsed.options, ['task']) ?? parsed.positionals.join(' ').trim();
  if (!rawTask) {
    io.stderr('Missing required task description. Pass --task "..." or provide a positional task string.');
    return { exitCode: 2 };
  }

  const keywordResolution = extractLeadingSubagentKeywords(rawTask);
  const task = keywordResolution.cleanedTask;
  if (!task) {
    io.stderr(
      'Task text is empty after removing leading subagent keywords. Add a task description after the tags.',
    );
    return { exitCode: 2 };
  }

  const backendOptionRaw = getStringOption(parsed.options, ['backend']);
  if (backendOptionRaw !== undefined && !isTeamBackend(backendOptionRaw)) {
    io.stderr(`Invalid --backend value: ${backendOptionRaw}. Expected: tmux | subagents`);
    return { exitCode: 2 };
  }

  const backendRaw: TeamBackend =
    backendOptionRaw ??
    (keywordResolution.requestedSubagentsBackend ||
    keywordResolution.subagents.length > 0
      ? 'subagents'
      : 'tmux');

  if (!isTeamBackend(backendRaw)) {
    io.stderr(`Invalid --backend value: ${backendRaw}. Expected: tmux | subagents`);
    return { exitCode: 2 };
  }

  let maxFixLoop = 1;
  try {
    maxFixLoop = parseNumberOption(getStringOption(parsed.options, ['max-fix-loop']), 1);
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  let watchdogMs: number | undefined;
  let nonReportingMs: number | undefined;
  let explicitSubagents: string[] | undefined;
  try {
    watchdogMs = parsePositiveNumberOption(
      getStringOption(parsed.options, ['watchdog-ms']),
    );
    nonReportingMs = parsePositiveNumberOption(
      getStringOption(parsed.options, ['non-reporting-ms']),
    );
    explicitSubagents = parseSubagentList(
      getStringOption(parsed.options, ['subagents']),
    );
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const subagents = mergeSubagentSelection(
    explicitSubagents,
    keywordResolution.subagents,
  );

  if (
    backendRaw !== 'subagents' &&
    (keywordResolution.requestedSubagentsBackend ||
      (subagents && subagents.length > 0))
  ) {
    io.stderr('--subagents is only supported when --backend subagents is selected.');
    return { exitCode: 2 };
  }

  const input: TeamRunInput = {
    teamName: normalizeTeamName(getStringOption(parsed.options, ['team'])),
    task,
    backend: backendRaw,
    subagents,
    maxFixLoop,
    watchdogMs,
    nonReportingMs,
    dryRun: hasFlag(parsed.options, ['dry-run']),
    cwd: context.cwd,
  };

  const runner = context.teamRunner ?? defaultTeamRunner;
  const output = await runner(input);

  if (hasFlag(parsed.options, ['json'])) {
    io.stdout(JSON.stringify(output, null, 2));
  } else {
    io.stdout(output.message);
    if (output.details) {
      io.stdout(JSON.stringify(output.details, null, 2));
    }
  }

  return {
    exitCode: output.exitCode,
  };
}
