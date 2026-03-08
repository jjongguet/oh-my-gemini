import { TeamStateStore, type PersistedPhaseTransitionEvent } from '../../state/index.js';
import { TeamControlPlane } from '../../team/control-plane/index.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';
import { normalizeTeamName } from './team-command-shared.js';
import { assertAllowedWorkdir } from './workdir-security.js';

export interface TeamCancelInput {
  teamName: string;
  cwd: string;
  force: boolean;
}

export interface TeamCancelOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface TeamCancelCommandContext {
  io: CliIo;
  cwd: string;
  cancelRunner?: (input: TeamCancelInput) => Promise<TeamCancelOutput>;
}

function printTeamCancelHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg team cancel [--team <name>] [--force] [--json]',
    '',
    'Options:',
    '  --team <name>   Team state namespace (default: oh-my-gemini)',
    '  --force         Succeed even when no persisted phase or tasks are present',
    '  --json          Print machine-readable output',
    '  --help          Show command help',
  ].join('\n'));
}

async function defaultCancelRunner(input: TeamCancelInput): Promise<TeamCancelOutput> {
  const cwd = assertAllowedWorkdir(input.cwd, {
    baseCwd: input.cwd,
    env: process.env,
    label: 'team cancel workdir',
  });
  const teamName = normalizeTeamName(input.teamName);
  const stateStore = new TeamStateStore({ cwd });
  const controlPlane = new TeamControlPlane({ stateStore });
  const [phase, tasks] = await Promise.all([
    stateStore.readPhaseState(teamName),
    stateStore.listTasks(teamName),
  ]);

  if (!phase && tasks.length === 0) {
    if (input.force) {
      return {
        exitCode: 0,
        message: `Team "${teamName}" has no persisted phase/tasks; treated as no-op because --force is set.`,
        details: {
          teamName,
          stateRoot: stateStore.rootDir,
          noop: true,
          force: true,
        },
      };
    }

    return {
      exitCode: 1,
      message: `Cannot cancel team "${teamName}" because no persisted phase or tasks were found.`,
      details: {
        teamName,
        stateRoot: stateStore.rootDir,
        noop: true,
        force: false,
      },
    };
  }

  const now = new Date().toISOString();
  const cancelledTasks: string[] = [];

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled' || task.status === 'canceled') {
      continue;
    }

    await controlPlane.cancelTask({
      teamName,
      taskId: task.id,
      worker: 'system-cancel',
      reason: task.error ?? 'Cancelled via omg team cancel.',
    });

    cancelledTasks.push(task.id);
  }

  let phaseUpdated = false;
  if (phase && phase.currentPhase !== 'completed' && phase.currentPhase !== 'failed') {
    const transition: PersistedPhaseTransitionEvent = {
      teamName,
      runId: phase.runId,
      from: phase.currentPhase,
      to: 'failed',
      at: now,
      reason: 'Team run cancelled via omg team cancel.',
      metadata: {
        invokedBy: 'omg team cancel',
        force: input.force,
        cancellationType: 'operator_requested',
      },
    };

    await stateStore.writePhaseState(teamName, {
      ...phase,
      currentPhase: 'failed',
      updatedAt: now,
      lastError: transition.reason,
      transitions: [...phase.transitions, transition],
    });
    await stateStore.appendPhaseTransition(teamName, transition);
    phaseUpdated = true;
  }

  return {
    exitCode: 0,
    message: `Team "${teamName}" cancelled (${cancelledTasks.length} task(s) marked cancelled${phaseUpdated ? ', phase marked failed' : ''}).`,
    details: {
      teamName,
      cancelledTasks,
      phaseUpdated,
      stateRoot: stateStore.rootDir,
    },
  };
}

export async function executeTeamCancelCommand(
  argv: string[],
  context: TeamCancelCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printTeamCancelHelp(io);
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
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}.`);
    return { exitCode: 2 };
  }

  let teamName: string;
  try {
    teamName = normalizeTeamName(getStringOption(parsed.options, ['team']));
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const runner = context.cancelRunner ?? defaultCancelRunner;
  let output: TeamCancelOutput;
  try {
    output = await runner({
      teamName,
      cwd: assertAllowedWorkdir(context.cwd, {
        baseCwd: context.cwd,
        env: process.env,
        label: 'team cancel workdir',
      }),
      force: hasFlag(parsed.options, ['force']),
    });
  } catch (error) {
    output = {
      exitCode: 1,
      message: `Team cancel failed: ${(error as Error).message}`,
    };
  }

  if (hasFlag(parsed.options, ['json'])) {
    io.stdout(JSON.stringify(output, null, 2));
  } else {
    io.stdout(output.message);
    if (output.details) {
      io.stdout(JSON.stringify(output.details, null, 2));
    }
  }

  return { exitCode: output.exitCode };
}
