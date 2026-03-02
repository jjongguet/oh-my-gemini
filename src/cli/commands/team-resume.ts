import { TeamStateStore } from '../../state/index.js';
import {
  CLI_USAGE_EXIT_CODE,
  DEFAULT_FIX_LOOP_CAP,
  DEFAULT_WORKERS,
  MAX_WORKERS,
  MIN_WORKERS,
} from '../../team/constants.js';
import { normalizeSubagentId } from '../../team/subagents-catalog.js';
import { TeamOrchestrator } from '../../team/team-orchestrator.js';
import type { RuntimeBackendName } from '../../team/runtime/runtime-backend.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';
import {
  isTeamBackend,
  normalizeTeamName,
  readTeamRunRequest,
  type TeamBackend,
} from './team-command-shared.js';

export interface TeamResumeInput {
  teamName: string;
  cwd: string;
  dryRun: boolean;
  task?: string;
  backend?: TeamBackend;
  workers?: number;
  subagents?: string[];
  maxFixLoop?: number;
  watchdogMs?: number;
  nonReportingMs?: number;
}

export interface TeamResumeOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface TeamResumeCommandContext {
  io: CliIo;
  cwd: string;
  /**
   * @deprecated Prefer teamResumeRunner; kept for compatibility.
   */
  resumeRunner?: (input: TeamResumeInput) => Promise<TeamResumeOutput>;
  teamResumeRunner?: (input: TeamResumeInput) => Promise<TeamResumeOutput>;
}

interface PersistedRuntimeInput {
  task?: string;
  cwd?: string;
  backend?: TeamBackend;
  workers?: number;
  subagents?: string[];
  maxFixLoop?: number;
  watchdogMs?: number;
  nonReportingMs?: number;
}

function printTeamResumeHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg team resume [--team <name>] [--max-fix-loop <0..3>] [--watchdog-ms <n>] [--non-reporting-ms <n>] [--dry-run] [--json]',
    '',
    'Options:',
    '  --team <name>         Team state namespace (default: oh-my-gemini)',
    '  --max-fix-loop <n>    Override max fix attempts for resumed run (0..3)',
    '  --watchdog-ms <n>     Override watchdog threshold in milliseconds',
    '  --non-reporting-ms <n>  Override heartbeat staleness threshold in milliseconds',
    '  --task <text>         Override task text when persisted run metadata is missing',
    '  --backend <name>      Override backend (tmux|subagents)',
    '  --workers <n>         Override worker count (1..8)',
    '  --subagents <ids>     Override comma-separated subagent assignments',
    '  --dry-run             Validate resolved resume input without executing runtime',
    '  --json                Print machine-readable output',
    '  --help                Show command help',
  ].join('\n'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function parseFixLoopOption(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > DEFAULT_FIX_LOOP_CAP) {
    throw new Error(
      `Invalid --max-fix-loop value: ${raw}. Expected integer 0..${DEFAULT_FIX_LOOP_CAP}.`,
    );
  }

  return parsed;
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

function parseSubagentList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return dedupeSubagentIds(raw.split(','), {
    emptyError: 'Expected at least one comma-separated subagent id for --subagents.',
  });
}

function readPersistedRuntimeInput(rawRuntime: unknown): PersistedRuntimeInput {
  if (!isRecord(rawRuntime)) {
    return {};
  }

  const runInput = rawRuntime.runInput;
  if (!isRecord(runInput)) {
    return {};
  }

  const workers =
    typeof runInput.workers === 'number' && Number.isInteger(runInput.workers)
      ? runInput.workers
      : undefined;

  const subagents = Array.isArray(runInput.subagents)
    ? dedupeSubagentIds(
        runInput.subagents.map((entry) => (typeof entry === 'string' ? entry : '')),
      )
    : undefined;
  const backendRaw =
    typeof runInput.backend === 'string' ? runInput.backend : undefined;

  return {
    task: typeof runInput.task === 'string' ? runInput.task : undefined,
    cwd: typeof runInput.cwd === 'string' ? runInput.cwd : undefined,
    backend: isTeamBackend(backendRaw) ? backendRaw : undefined,
    workers,
    subagents,
    maxFixLoop:
      typeof runInput.maxFixLoop === 'number' && Number.isInteger(runInput.maxFixLoop)
        ? runInput.maxFixLoop
        : undefined,
    watchdogMs:
      typeof runInput.watchdogMs === 'number' && Number.isInteger(runInput.watchdogMs)
        ? runInput.watchdogMs
        : undefined,
    nonReportingMs:
      typeof runInput.nonReportingMs === 'number' && Number.isInteger(runInput.nonReportingMs)
        ? runInput.nonReportingMs
        : undefined,
  };
}

function mergePersistedRuntimeInputs(
  base: PersistedRuntimeInput,
  override: PersistedRuntimeInput,
): PersistedRuntimeInput {
  return {
    task: override.task ?? base.task,
    cwd: override.cwd ?? base.cwd,
    backend: override.backend ?? base.backend,
    workers: override.workers ?? base.workers,
    subagents: override.subagents ?? base.subagents,
    maxFixLoop: override.maxFixLoop ?? base.maxFixLoop,
    watchdogMs: override.watchdogMs ?? base.watchdogMs,
    nonReportingMs: override.nonReportingMs ?? base.nonReportingMs,
  };
}

function resolveBackend(
  snapshotBackend: string | undefined,
  persistedBackend: TeamBackend | undefined,
  overrideBackend: TeamBackend | undefined,
): TeamBackend {
  if (overrideBackend) {
    return overrideBackend;
  }

  if (persistedBackend) {
    return persistedBackend;
  }

  return snapshotBackend === 'subagents' ? 'subagents' : 'tmux';
}

function resolveWorkers(params: {
  backend: TeamBackend;
  persistedWorkers?: number;
  workersOverride?: number;
  subagents?: string[];
}): number {
  const {
    backend,
    persistedWorkers,
    workersOverride,
    subagents,
  } = params;

  if (backend === 'subagents' && subagents && subagents.length > 0) {
    if (workersOverride !== undefined && workersOverride !== subagents.length) {
      throw new Error(
        `Subagents worker mismatch: --workers=${workersOverride} but ${subagents.length} subagent assignment(s) were provided.`,
      );
    }
    return subagents.length;
  }

  return workersOverride ?? persistedWorkers ?? DEFAULT_WORKERS;
}

function assertWorkerRange(workers: number): void {
  if (!Number.isInteger(workers) || workers < MIN_WORKERS || workers > MAX_WORKERS) {
    throw new Error(
      `Invalid worker count: ${workers}. Expected integer ${MIN_WORKERS}..${MAX_WORKERS}.`,
    );
  }
}

function buildRunMetadata(input: TeamResumeInput): Record<string, unknown> {
  return {
    invokedBy: 'omg team resume',
    resumedAt: new Date().toISOString(),
    overrides: {
      task: input.task !== undefined,
      backend: input.backend !== undefined,
      workers: input.workers !== undefined,
      subagents: input.subagents !== undefined,
      maxFixLoop: input.maxFixLoop !== undefined,
      watchdogMs: input.watchdogMs !== undefined,
      nonReportingMs: input.nonReportingMs !== undefined,
    },
  };
}

async function defaultResumeRunner(input: TeamResumeInput): Promise<TeamResumeOutput> {
  let teamName: string;
  try {
    teamName = normalizeTeamName(input.teamName);
  } catch (error) {
    return {
      exitCode: 1,
      message: `Invalid team name: ${(error as Error).message}`,
      details: {
        teamName: input.teamName,
      },
    };
  }

  const stateStore = new TeamStateStore({ cwd: input.cwd });
  const [phase, snapshot, runRequest] = await Promise.all([
    stateStore.readPhaseState(teamName),
    stateStore.readMonitorSnapshot(teamName),
    readTeamRunRequest(input.cwd, teamName),
  ]);

  if (!runRequest) {
    return {
      exitCode: 1,
      message: `No run request state found for team "${teamName}". Run "omg team run ..." first.`,
      details: {
        teamName,
        stateRoot: stateStore.rootDir,
      },
    };
  }

  const runtimeInput = readPersistedRuntimeInput(snapshot?.runtime);
  const runRequestInput: PersistedRuntimeInput = {
    task: runRequest.task,
    cwd: runRequest.cwd,
    backend: runRequest.backend,
    workers: runRequest.workers,
    subagents: runRequest.subagents,
    maxFixLoop: runRequest.maxFixLoop,
    watchdogMs: runRequest.watchdogMs,
    nonReportingMs: runRequest.nonReportingMs,
  };
  const persistedInput = mergePersistedRuntimeInputs(
    runRequestInput,
    runtimeInput,
  );

  const task = input.task ?? persistedInput.task;
  if (!task || task.trim() === '') {
    return {
      exitCode: 1,
      message:
        `Cannot resume team "${teamName}" because persisted task metadata is missing.` +
        ' Re-run with --task "<description>" once, then resume will persist metadata.',
      details: {
        teamName,
        stateRoot: stateStore.rootDir,
      },
    };
  }

  const executionDefaults: PersistedRuntimeInput = persistedInput;

  const backend = resolveBackend(snapshot?.backend, executionDefaults.backend, input.backend);
  const subagents = input.subagents ?? executionDefaults.subagents;

  if (backend !== 'subagents' && subagents && subagents.length > 0) {
    return {
      exitCode: 1,
      message: 'Subagent role assignments are only supported when backend is subagents.',
      details: {
        teamName,
        backend,
        subagents,
      },
    };
  }

  let workers: number;
  try {
    workers = resolveWorkers({
      backend,
      persistedWorkers: executionDefaults.workers,
      workersOverride: input.workers,
      subagents,
    });
    assertWorkerRange(workers);
  } catch (error) {
    return {
      exitCode: 1,
      message: (error as Error).message,
      details: {
        teamName,
        backend,
      },
    };
  }

  const maxFixLoop =
    input.maxFixLoop ??
    executionDefaults.maxFixLoop ??
    phase?.maxFixAttempts ??
    DEFAULT_FIX_LOOP_CAP;

  const watchdogMs = input.watchdogMs ?? executionDefaults.watchdogMs;
  const nonReportingMs = input.nonReportingMs ?? executionDefaults.nonReportingMs;

  if (input.dryRun) {
    return {
      exitCode: 0,
      message: `Dry run passed for team "${teamName}". Resume input resolved.`,
      details: {
        teamName,
        backend,
        workers,
        subagents,
        task,
        maxFixLoop,
        watchdogMs,
        nonReportingMs,
        source: {
          runRequest: true,
          snapshot: snapshot !== null,
        },
      },
    };
  }

  if (!snapshot) {
    return {
      exitCode: 1,
      message: `Cannot resume team "${teamName}" because no persisted monitor snapshot was found.`,
      details: {
        teamName,
        stateRoot: stateStore.rootDir,
      },
    };
  }

  const orchestrator = new TeamOrchestrator({ stateStore });
  const runResult = await orchestrator.run({
    teamName,
    task,
    cwd: executionDefaults.cwd ?? input.cwd,
    backend: backend as RuntimeBackendName,
    workers,
    subagents,
    maxFixAttempts: maxFixLoop,
    watchdogMs,
    nonReportingMs,
    metadata: buildRunMetadata(input),
  });

  if (runResult.handle) {
    await orchestrator.shutdown(runResult.handle, true).catch(() => undefined);
  }

  if (runResult.success) {
    return {
      exitCode: 0,
      message: `Team "${teamName}" resumed successfully (phase=${runResult.phase}, backend=${runResult.backend}).`,
      details: {
        teamName,
        backend: runResult.backend,
        phase: runResult.phase,
        attempts: runResult.attempts,
        resumedFromSnapshot: snapshot.handleId,
        workers,
        subagents,
        maxFixLoop,
        watchdogMs,
        nonReportingMs,
      },
    };
  }

  return {
    exitCode: 1,
    message: runResult.error
      ? `Team resume failed: ${runResult.error}`
      : `Team resume failed in phase "${runResult.phase}".`,
    details: {
      teamName,
      backend: runResult.backend,
      phase: runResult.phase,
      attempts: runResult.attempts,
      resumedFromSnapshot: snapshot.handleId,
      workers,
      subagents,
      maxFixLoop,
      watchdogMs,
      nonReportingMs,
      issues: runResult.issues,
    },
  };
}

export async function executeTeamResumeCommand(
  argv: string[],
  context: TeamResumeCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printTeamResumeHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'team',
    'task',
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
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}.`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const backendRaw = getStringOption(parsed.options, ['backend']);
  let backend: TeamBackend | undefined;
  if (backendRaw !== undefined) {
    if (!isTeamBackend(backendRaw)) {
      io.stderr(`Invalid --backend value: ${backendRaw}. Expected: tmux | subagents`);
      return { exitCode: CLI_USAGE_EXIT_CODE };
    }

    backend = backendRaw;
  }

  let workers: number | undefined;
  let maxFixLoop: number | undefined;
  let watchdogMs: number | undefined;
  let nonReportingMs: number | undefined;
  let subagents: string[] | undefined;

  try {
    workers = parseWorkerCountOption(getStringOption(parsed.options, ['workers']));
    maxFixLoop = parseFixLoopOption(getStringOption(parsed.options, ['max-fix-loop']));
    watchdogMs = parsePositiveNumberOption(getStringOption(parsed.options, ['watchdog-ms']));
    nonReportingMs = parsePositiveNumberOption(getStringOption(parsed.options, ['non-reporting-ms']));
    subagents = parseSubagentList(getStringOption(parsed.options, ['subagents']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let teamName: string;
  try {
    teamName = normalizeTeamName(getStringOption(parsed.options, ['team']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const input: TeamResumeInput = {
    teamName,
    cwd: context.cwd,
    dryRun: hasFlag(parsed.options, ['dry-run']),
    task: getStringOption(parsed.options, ['task']),
    backend,
    workers,
    subagents,
    maxFixLoop,
    watchdogMs,
    nonReportingMs,
  };

  const runner =
    context.teamResumeRunner ??
    context.resumeRunner ??
    defaultResumeRunner;
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
