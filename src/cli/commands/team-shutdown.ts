import {
  TeamStateStore,
  type PersistedPhaseTransitionEvent,
} from '../../state/index.js';
import { CLI_USAGE_EXIT_CODE } from '../../team/constants.js';
import { TeamOrchestrator } from '../../team/team-orchestrator.js';
import type { TeamHandle } from '../../team/types.js';
import type { RuntimeBackendName } from '../../team/runtime/runtime-backend.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';
import { normalizeTeamName } from './team-command-shared.js';
import { assertAllowedWorkdir } from './workdir-security.js';

export interface TeamShutdownInput {
  teamName: string;
  force: boolean;
  cwd: string;
}

export interface TeamShutdownOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface TeamShutdownCommandContext {
  io: CliIo;
  cwd: string;
  /**
   * @deprecated Prefer teamShutdownRunner; kept for compatibility.
   */
  shutdownRunner?: (input: TeamShutdownInput) => Promise<TeamShutdownOutput>;
  teamShutdownRunner?: (input: TeamShutdownInput) => Promise<TeamShutdownOutput>;
}

function printTeamShutdownHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg team shutdown [--team <name>] [--force] [--json]',
    '',
    'Options:',
    '  --team <name>   Team state namespace (default: oh-my-gemini)',
    '  --force         Ignore runtime teardown errors where possible',
    '  --json          Print machine-readable output',
    '  --help          Show command help',
  ].join('\n'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveBackendName(raw: string | undefined): RuntimeBackendName {
  if (raw === 'tmux' || raw === 'subagents') {
    return raw;
  }
  return 'tmux';
}

function resolveHandleCwd(runtime: Record<string, unknown>, fallbackCwd: string): string {
  const runInput = runtime.runInput;
  if (
    isRecord(runInput) &&
    typeof runInput.cwd === 'string' &&
    runInput.cwd.trim() !== ''
  ) {
    return assertAllowedWorkdir(runInput.cwd, {
      baseCwd: fallbackCwd,
      env: process.env,
      label: 'persisted team shutdown workdir',
    });
  }

  return assertAllowedWorkdir(fallbackCwd, {
    baseCwd: fallbackCwd,
    env: process.env,
    label: 'team shutdown workdir',
  });
}

async function persistShutdownTransition(params: {
  stateStore: TeamStateStore;
  teamName: string;
  force: boolean;
}): Promise<void> {
  const phase = await params.stateStore.readPhaseState(params.teamName);
  if (!phase) {
    return;
  }

  if (phase.currentPhase === 'completed' || phase.currentPhase === 'failed') {
    return;
  }

  const at = new Date().toISOString();
  const shutdownReason =
    'Operational shutdown requested via omg team shutdown before success completion.';
  const transition: PersistedPhaseTransitionEvent = {
    teamName: params.teamName,
    runId: phase.runId,
    from: phase.currentPhase,
    to: 'failed',
    at,
    reason: shutdownReason,
    metadata: {
      force: params.force,
      invokedBy: 'omg team shutdown',
      shutdownType: 'operational_stop',
    },
  };

  phase.currentPhase = 'failed';
  phase.updatedAt = at;
  phase.lastError = shutdownReason;
  phase.transitions.push(transition);

  await params.stateStore.writePhaseState(params.teamName, phase);
  await params.stateStore.appendPhaseTransition(params.teamName, transition);
}

async function defaultShutdownRunner(
  input: TeamShutdownInput,
): Promise<TeamShutdownOutput> {
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

  const validatedInputCwd = assertAllowedWorkdir(input.cwd, {
    baseCwd: input.cwd,
    env: process.env,
    label: 'team shutdown workdir',
  });

  const stateStore = new TeamStateStore({ cwd: validatedInputCwd });
  const snapshot = await stateStore.readMonitorSnapshot(teamName);

  if (!snapshot) {
    if (input.force) {
      return {
        exitCode: 0,
        message: `Team "${teamName}" monitor snapshot is missing; treated as no-op because --force is set.`,
        details: {
          teamName,
          stateRoot: stateStore.rootDir,
          force: true,
          noop: true,
        },
      };
    }

    return {
      exitCode: 1,
      message: `Cannot shutdown team "${teamName}" because no persisted monitor snapshot was found.`,
      details: {
        teamName,
        stateRoot: stateStore.rootDir,
        force: false,
        noop: true,
      },
    };
  }

  const runtime = isRecord(snapshot.runtime) ? snapshot.runtime : {};
  const handle: TeamHandle = {
    id: snapshot.handleId,
    teamName,
    backend: resolveBackendName(snapshot.backend),
    cwd: resolveHandleCwd(runtime, input.cwd),
    startedAt: snapshot.updatedAt,
    runtime,
  };

  const orchestrator = new TeamOrchestrator({ stateStore });

  try {
    await orchestrator.shutdown(handle, input.force);
  } catch (error) {
    return {
      exitCode: 1,
      message: `Team shutdown failed: ${(error as Error).message}`,
      details: {
        teamName,
        backend: handle.backend,
        force: input.force,
      },
    };
  }

  const now = new Date().toISOString();
  let stateWriteWarning: string | undefined;
  try {
    await stateStore.writeMonitorSnapshot(teamName, {
      ...snapshot,
      status: 'stopped',
      updatedAt: now,
      summary: `Operational shutdown requested via omg team shutdown (force=${input.force}).`,
      failureReason: undefined,
      runtime: {
        ...runtime,
        operationalStop: true,
        shutdownForce: input.force,
        shutdown: {
          requestedAt: now,
          force: input.force,
          requestedBy: 'omg team shutdown',
        },
        verifyBaselinePassed: false,
        verifyBaselineSource: 'shutdown',
      },
    });

    await persistShutdownTransition({
      stateStore,
      teamName,
      force: input.force,
    });
  } catch (stateError) {
    stateWriteWarning = `Warning: runtime stopped but state update failed: ${(stateError as Error).message}`;
  }

  return {
    exitCode: 0,
    message: stateWriteWarning
      ? `Team "${teamName}" shutdown complete (backend=${handle.backend}, force=${input.force}). ${stateWriteWarning}`
      : `Team "${teamName}" shutdown complete (backend=${handle.backend}, force=${input.force}).`,
    details: {
      teamName,
      backend: handle.backend,
      force: input.force,
      stateRoot: stateStore.rootDir,
      ...(stateWriteWarning ? { stateWriteWarning } : {}),
    },
  };
}

export async function executeTeamShutdownCommand(
  argv: string[],
  context: TeamShutdownCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printTeamShutdownHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'team',
    'force',
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

  let teamName: string;
  try {
    teamName = normalizeTeamName(getStringOption(parsed.options, ['team']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const input: TeamShutdownInput = {
    teamName,
    force: hasFlag(parsed.options, ['force']),
    cwd: assertAllowedWorkdir(context.cwd, {
      baseCwd: context.cwd,
      env: process.env,
      label: 'team shutdown workdir',
    }),
  };

  const runner =
    context.teamShutdownRunner ??
    context.shutdownRunner ??
    defaultShutdownRunner;
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
