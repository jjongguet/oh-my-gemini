import path from 'node:path';

import {
  CLI_USAGE_EXIT_CODE,
  DEFAULT_FIX_LOOP_CAP,
  DEFAULT_WORKERS,
  MAX_WORKERS,
  MIN_WORKERS,
  isLegacyRunningSuccessEnabled,
} from '../../team/constants.js';
import { validateShellSafe, validateTaskId, validateWorkerCount } from '../../utils/security.js';
import { normalizeSubagentId } from '../../team/subagents-catalog.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import {
  getTeamStateDir,
  getTeamRunRequestPath,
  isTeamBackend,
  normalizeTeamName,
  persistTeamRunRequest,
  type TeamBackend,
} from './team-command-shared.js';
import {
  getTeamResumeInputPath,
  writeTeamResumeInputState,
} from './team-lifecycle-state.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

export interface TeamRunInput {
  teamName: string;
  task: string;
  backend: TeamBackend;
  workers: number;
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
  requestedBackend?: TeamBackend;
  conflictingBackends: TeamBackend[];
}

const SUBAGENTS_BACKEND_KEYWORDS = new Set([
  'subagents',
  'subagent',
  'agents',
]);
const TMUX_BACKEND_KEYWORDS = new Set(['tmux']);
const SUBAGENT_KEYWORD_TOKEN_PATTERN = /^([/$])([a-zA-Z0-9][a-zA-Z0-9._-]*)$/;

function printTeamRunHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg team run --task "<description>" [--team <name>] [--backend tmux|subagents] [--workers <1..8>] [--subagents <ids>] [--max-fix-loop <n>] [--dry-run] [--json]',
    '',
    'Options:',
    '  --task <text>        Required task description for orchestration',
    '  --team <name>        Team state namespace (default: oh-my-gemini)',
    '  --backend <name>     Runtime backend (default: tmux, auto-selected by leading backend tags when omitted)',
    `  --workers <n>        Worker count (${MIN_WORKERS}..${MAX_WORKERS}, default: ${DEFAULT_WORKERS}; subagents with explicit assignments must match count)`,
    '  --subagents <ids>    Comma-separated subagent ids (subagents backend only)',
    `  --max-fix-loop <n>   Max fix attempts before fail (0..${DEFAULT_FIX_LOOP_CAP}, default: ${DEFAULT_FIX_LOOP_CAP})`,
    '  --watchdog-ms <n>    Snapshot watchdog threshold in milliseconds (optional)',
    '  --non-reporting-ms <n>  Worker heartbeat staleness threshold in milliseconds (optional)',
    '  --dry-run            Validate and print planned run without executing',
    '  --json               Print machine-readable output',
    '  --help               Show command help',
    '',
    'Keyword shortcuts:',
    '  Prefix the task with backend/subagent tags for deterministic selection.',
    '  Example: --task "$planner /executor implement onboarding flow"',
    '  Backend tags: /subagents | /agents | /tmux (same with $ prefix)',
    '  Skill tags map to primary roles: $plan->planner, /team->executor, /review->code-reviewer, /verify->verifier, /handoff->writer',
    '  Tags are parsed only at the beginning of the task text.',
  ].join('\n'));
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

function parseFixLoopOption(raw: string | undefined): number {
  const parsed = parseNumberOption(raw, DEFAULT_FIX_LOOP_CAP);
  if (parsed > DEFAULT_FIX_LOOP_CAP) {
    throw new Error(
      `Invalid --max-fix-loop value: ${raw}. Expected integer 0..${DEFAULT_FIX_LOOP_CAP}.`,
    );
  }

  return parsed;
}

function parseWorkerCountOption(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_WORKERS || parsed > MAX_WORKERS) {
    throw new Error(
      `Invalid --workers value: ${raw}. Expected integer ${MIN_WORKERS}..${MAX_WORKERS}.`,
    );
  }

  return parsed;
}

function assertWorkerCountWithinRange(count: number): void {
  if (!Number.isInteger(count) || count < MIN_WORKERS || count > MAX_WORKERS) {
    throw new Error(
      `Invalid --workers value: ${count}. Expected integer ${MIN_WORKERS}..${MAX_WORKERS}.`,
    );
  }
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
    .map((entry) => normalizeSubagentId(entry))
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
      conflictingBackends: [],
    };
  }

  const tokens = trimmed.split(/\s+/);
  const keywordTokens: string[] = [];
  const assignments: string[] = [];
  const requestedBackends = new Set<TeamBackend>();

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
      requestedBackends.add('subagents');
      continue;
    }

    if (TMUX_BACKEND_KEYWORDS.has(keywordId)) {
      requestedBackends.add('tmux');
      continue;
    }

    assignments.push(keywordId);
  }

  if (keywordTokens.length === 0) {
    return {
      cleanedTask: trimmed,
      subagents: [],
      conflictingBackends: [],
    };
  }

  const cleanedTask = tokens.slice(keywordTokens.length).join(' ').trim();
  const conflictingBackends =
    requestedBackends.size > 1
      ? [...requestedBackends].sort((a, b) => a.localeCompare(b))
      : [];
  const requestedBackend =
    conflictingBackends.length === 0 ? [...requestedBackends][0] : undefined;

  return {
    cleanedTask,
    subagents: dedupeSubagentIds(assignments),
    requestedBackend,
    conflictingBackends,
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

function resolveWorkerCountForBackend(params: {
  backend: TeamBackend;
  explicitWorkers: number | undefined;
  resolvedSubagents: string[] | undefined;
}): number {
  const { backend, explicitWorkers, resolvedSubagents } = params;

  if (backend === 'tmux') {
    const resolved = explicitWorkers ?? DEFAULT_WORKERS;
    assertWorkerCountWithinRange(resolved);
    return resolved;
  }

  const assignmentCount = resolvedSubagents?.length;
  if (assignmentCount && assignmentCount > 0) {
    if (explicitWorkers !== undefined && explicitWorkers !== assignmentCount) {
      throw new Error(
        `Subagents worker mismatch: --workers=${explicitWorkers} but ${assignmentCount} subagent assignment(s) were resolved.`,
      );
    }

    assertWorkerCountWithinRange(assignmentCount);
    return assignmentCount;
  }

  const resolved = explicitWorkers ?? DEFAULT_WORKERS;
  assertWorkerCountWithinRange(resolved);
  return resolved;
}

export async function runTeamCommand(input: TeamRunInput): Promise<TeamRunOutput> {
  let teamName: string;
  try {
    teamName = normalizeTeamName(input.teamName);
  } catch (error) {
    return {
      exitCode: 1,
      message: `Failed to persist run request: ${(error as Error).message}`,
      details: {
        teamName: input.teamName,
      },
    };
  }

  const teamStateDir = getTeamStateDir(input.cwd, teamName);
  const runRequestPath = getTeamRunRequestPath(input.cwd, teamName);
  const resumeInputPath = getTeamResumeInputPath(input.cwd, teamName);
  const taskAuditLogPath = path.join(
    teamStateDir,
    'events',
    'task-lifecycle.ndjson',
  );

  if (input.dryRun) {
    return {
      exitCode: 0,
      message: 'Dry run passed. Team runtime invocation validated.',
      details: {
        teamName,
        backend: input.backend,
        workers: input.workers,
        task: input.task,
        subagents: input.subagents,
        maxFixLoop: input.maxFixLoop,
        watchdogMs: input.watchdogMs,
        nonReportingMs: input.nonReportingMs,
        runRequestPath,
        runRequestPersisted: false,
        resumeInputPath,
        resumeInputPersisted: false,
        taskAuditLogPath,
      },
    };
  }

  try {
    await persistTeamRunRequest({
      teamName,
      task: input.task,
      backend: input.backend,
      workers: input.workers,
      subagents: input.subagents,
      maxFixLoop: input.maxFixLoop,
      watchdogMs: input.watchdogMs,
      nonReportingMs: input.nonReportingMs,
      cwd: input.cwd,
    });

    await writeTeamResumeInputState(input.cwd, {
      teamName,
      task: input.task,
      backend: input.backend,
      workers: input.workers,
      subagents: input.subagents,
      maxFixLoop: input.maxFixLoop,
      watchdogMs: input.watchdogMs,
      nonReportingMs: input.nonReportingMs,
      cwd: input.cwd,
    });
  } catch (error) {
    return {
      exitCode: 1,
      message: `Failed to persist run request: ${(error as Error).message}`,
      details: {
        teamName,
        backend: input.backend,
        workers: input.workers,
        task: input.task,
        subagents: input.subagents,
        maxFixLoop: input.maxFixLoop,
        watchdogMs: input.watchdogMs,
        nonReportingMs: input.nonReportingMs,
        runRequestPath,
        resumeInputPath,
        taskAuditLogPath,
      },
    };
  }

  const { TeamOrchestrator } = await import('../../team/team-orchestrator.js');
  const orchestrator = new TeamOrchestrator();

  const runResult = await orchestrator.run({
    teamName,
    task: input.task,
    cwd: input.cwd,
    backend: input.backend,
    workers: input.workers,
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

  const phaseFilePath = path.join(teamStateDir, 'phase.json');

  if (runResult.success) {
    return {
      exitCode: 0,
      message: `Team run completed with backend "${runResult.backend}" (phase=${runResult.phase}).`,
      details: {
        teamName,
        backend: runResult.backend,
        workers: input.workers,
        phase: runResult.phase,
        attempts: runResult.attempts,
        subagents: input.subagents,
        watchdogMs: input.watchdogMs,
        nonReportingMs: input.nonReportingMs,
        phaseFilePath,
        runRequestPath,
        resumeInputPath,
        taskAuditLogPath,
      },
    };
  }

  return {
    exitCode: 1,
    message: runResult.error
      ? `Team run failed: ${runResult.error}`
      : `Team run failed in phase "${runResult.phase}".`,
    details: {
      teamName,
      backend: runResult.backend,
      workers: input.workers,
      task: input.task,
      phase: runResult.phase,
      attempts: runResult.attempts,
      subagents: input.subagents,
      watchdogMs: input.watchdogMs,
      nonReportingMs: input.nonReportingMs,
      issues: runResult.issues,
      phaseFilePath,
      runRequestPath,
      resumeInputPath,
      taskAuditLogPath,
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

  const unknownOptions = findUnknownOptions(parsed.options, [
    'task',
    'team',
    'backend',
    'workers',
    'subagents',
    'max-fix-loop',
    'watchdog-ms',
    'non-reporting-ms',
    'dry-run',
    'json',
    'help',
    'h',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(
      `Unexpected positional arguments: ${parsed.positionals.join(' ')}. Use --task "<description>".`,
    );
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const rawTask = getStringOption(parsed.options, ['task']);
  if (!rawTask) {
    io.stderr('Missing required task description. Pass --task "<description>".');
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  // Security: Validate task input for shell safety
  try {
    validateTaskId(rawTask);
  } catch (error) {
    io.stderr(`Invalid task: ${(error as Error).message}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const keywordResolution = extractLeadingSubagentKeywords(rawTask);
  if (keywordResolution.conflictingBackends.length > 0) {
    io.stderr(
      `Conflicting backend keywords in task prefix: ${keywordResolution.conflictingBackends.join(' vs ')}. Use only one backend keyword (/tmux or /subagents).`,
    );
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const task = keywordResolution.cleanedTask;
  if (!task) {
    io.stderr(
      'Task text is empty after removing leading subagent keywords. Add a task description after the tags.',
    );
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const backendOptionRaw = getStringOption(parsed.options, ['backend']);
  const subagentsOptionProvided =
    getStringOption(parsed.options, ['subagents']) !== undefined;
  if (backendOptionRaw !== undefined && !isTeamBackend(backendOptionRaw)) {
    io.stderr(`Invalid --backend value: ${backendOptionRaw}. Expected: tmux | subagents`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const backendRaw: TeamBackend =
    backendOptionRaw ??
    keywordResolution.requestedBackend ??
    (keywordResolution.subagents.length > 0 ||
    subagentsOptionProvided
      ? 'subagents'
      : 'tmux');

  if (
    backendOptionRaw &&
    keywordResolution.requestedBackend &&
    backendOptionRaw !== keywordResolution.requestedBackend
  ) {
    io.stderr(
      `Backend conflict: --backend ${backendOptionRaw} does not match task keyword backend ${keywordResolution.requestedBackend}.`,
    );
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (!isTeamBackend(backendRaw)) {
    io.stderr(`Invalid --backend value: ${backendRaw}. Expected: tmux | subagents`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let maxFixLoop = DEFAULT_FIX_LOOP_CAP;
  try {
    maxFixLoop = parseFixLoopOption(
      getStringOption(parsed.options, ['max-fix-loop']),
    );
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let watchdogMs: number | undefined;
  let nonReportingMs: number | undefined;
  let explicitSubagents: string[] | undefined;
  let explicitWorkers: number | undefined;
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
    explicitWorkers = parseWorkerCountOption(
      getStringOption(parsed.options, ['workers']),
    );
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const subagents = mergeSubagentSelection(
    explicitSubagents,
    keywordResolution.subagents,
  );

  // Security: Validate worker count bounds
  try {
    validateWorkerCount(workers);
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (
    backendRaw !== 'subagents' &&
    subagents &&
    subagents.length > 0
  ) {
    io.stderr(
      'Subagent role assignments are only supported when --backend subagents is selected.',
    );
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let workers: number;
  try {
    workers = resolveWorkerCountForBackend({
      backend: backendRaw,
      explicitWorkers,
      resolvedSubagents: subagents,
    });
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (isLegacyRunningSuccessEnabled()) {
    io.stderr(
      'Warning: OMG_LEGACY_RUNNING_SUCCESS=1 is enabled. Running snapshots are treated as success for compatibility.',
    );
  }

  let teamName: string;
  try {
    teamName = normalizeTeamName(getStringOption(parsed.options, ['team']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const input: TeamRunInput = {
    teamName,
    task,
    backend: backendRaw,
    workers,
    subagents,
    maxFixLoop,
    watchdogMs,
    nonReportingMs,
    dryRun: hasFlag(parsed.options, ['dry-run']),
    cwd: context.cwd,
  };

  const runner = context.teamRunner ?? runTeamCommand;
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
