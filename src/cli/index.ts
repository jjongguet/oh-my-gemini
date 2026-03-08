#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeDoctorCommand, type DoctorCommandContext } from './commands/doctor.js';
import { executeLaunchCommand, type LaunchCommandContext } from './commands/launch.js';
import { executeHudCommand, type HudCommandContext } from './commands/hud.js';
import { executeMcpServeCommand, type McpServeCommandContext } from './commands/mcp.js';
import {
  executeExtensionPathCommand,
  type ExtensionPathCommandContext,
} from './commands/extension-path.js';
import { executeSetupCommand, type SetupCommandContext } from './commands/setup.js';
import { executeUpdateCommand, type UpdateCommandContext } from './commands/update.js';
import { executeUninstallCommand, type UninstallCommandContext } from './commands/uninstall.js';
import {
  executeTeamResumeCommand,
  type TeamResumeCommandContext,
} from './commands/team-resume.js';
import { executeTeamRunCommand, type TeamRunCommandContext } from './commands/team-run.js';
import { executeTeamCancelCommand, type TeamCancelCommandContext } from './commands/team-cancel.js';
import {
  executeTeamShutdownCommand,
  type TeamShutdownCommandContext,
} from './commands/team-shutdown.js';
import {
  executeTeamStatusCommand,
  type TeamStatusCommandContext,
} from './commands/team-status.js';
import { executeVerifyCommand, type VerifyCommandContext } from './commands/verify.js';
import { executeAskCommand, type AskCommandContext } from './commands/ask.js';
import { executeCostCommand, type CostCommandContext } from './commands/cost.js';
import { executeSessionsCommand, type SessionsCommandContext } from './commands/sessions.js';
import { executeWaitCommand, type WaitCommandContext } from './commands/wait.js';
import { executeVersionCommand, type VersionCommandContext } from './commands/version.js';
import { executeWorkerRunCommand } from './commands/worker-run.js';
import { executeSkillCommand } from './commands/skill.js';
import { executeToolsCommand, type ToolsCommandContext } from './commands/tools.js';
import { executePrdCommand } from './commands/prd.js';
import type { CliIo } from './types.js';

async function loadPackageJson(): Promise<{ version: string }> {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json') as { version: string };
    return pkg;
  } catch {
    return { version: 'unknown' };
  }
}

type CliCommand =
  | 'launch'
  | 'help'
  | 'version'
  | 'setup'
  | 'update'
  | 'uninstall'
  | 'doctor'
  | 'extension'
  | 'team'
  | 'worker'
  | 'skill'
  | 'prd'
  | 'tools'
  | 'hud'
  | 'mcp'
  | 'verify'
  | 'ask'
  | 'cost'
  | 'sessions'
  | 'wait'
  | string;

export interface ResolvedCliInvocation {
  command: CliCommand;
  launchArgs: string[];
}

export interface CliDependencies {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  io?: CliIo;
  setup?: Omit<SetupCommandContext, 'cwd' | 'io'>;
  update?: Omit<UpdateCommandContext, 'cwd' | 'io'>;
  uninstall?: Omit<UninstallCommandContext, 'cwd' | 'io'>;
  doctor?: Omit<DoctorCommandContext, 'cwd' | 'io'>;
  launch?: Omit<LaunchCommandContext, 'cwd' | 'io' | 'env'>;
  extensionPath?: Omit<ExtensionPathCommandContext, 'cwd' | 'io' | 'env'>;
  teamRun?: Omit<TeamRunCommandContext, 'cwd' | 'io'>;
  teamCancel?: Omit<TeamCancelCommandContext, 'cwd' | 'io'>;
  teamStatus?: Omit<TeamStatusCommandContext, 'cwd' | 'io'>;
  teamResume?: Omit<TeamResumeCommandContext, 'cwd' | 'io'>;
  teamShutdown?: Omit<TeamShutdownCommandContext, 'cwd' | 'io'>;
  verify?: Omit<VerifyCommandContext, 'cwd' | 'io'>;
  ask?: Omit<AskCommandContext, 'cwd' | 'io' | 'env'>;
  cost?: Omit<CostCommandContext, 'cwd' | 'io'>;
  sessions?: Omit<SessionsCommandContext, 'cwd' | 'io'>;
  wait?: Omit<WaitCommandContext, 'cwd' | 'io'>;
  version?: Omit<VersionCommandContext, 'cwd' | 'io'>;
  tools?: Omit<ToolsCommandContext, 'cwd' | 'io'>;
  hud?: Omit<HudCommandContext, 'cwd' | 'io' | 'env'>;
  mcpServe?: Omit<McpServeCommandContext, 'cwd' | 'io'>;
}

function defaultIo(): CliIo {
  return {
    stdout(message: string) {
      console.log(message);
    },
    stderr(message: string) {
      console.error(message);
    },
  };
}

function printGlobalHelp(io: CliIo): void {
  io.stdout([
    'oh-my-gemini CLI',
    '',
    'Usage:',
    '  omg [launch-flags]',
    '  omg <command> [options]',
    '',
    'Default behavior:',
    '  omg with no subcommand launches Gemini CLI interactively in tmux with the OMG extension loaded.',
    '',
    'Post-install contract:',
    '  After npm install -g oh-my-gemini-sisyphus, run setup to apply local files:',
    '  omg setup --scope project',
    '  # equivalent: oh-my-gemini setup --scope project',
    '',
    'Commands:',
    '  launch       Start interactive Gemini CLI in tmux with the OMG extension loaded',
    '  setup        Configure project/user setup artifacts and persisted scope',
    '  update       Update the globally installed CLI package via npm',
    '  uninstall    Uninstall the globally installed CLI package via npm',
    '  doctor       Diagnose runtime/tooling/state prerequisites with optional safe fixes',
    '  extension    Resolve extension package assets (for example: extension path)',
    '  team run     Execute team orchestration (tmux default backend)',
    '  team status  Inspect persisted team runtime/phase/task health',
    '  team resume  Resume team execution from persisted run metadata',
    '  team shutdown  Shutdown persisted runtime handle (graceful by default)',
    '  team cancel  Mark active tasks cancelled and stop further lifecycle progress',
    '  worker run   Worker bootstrap (runs inside tmux panes)',
    '  skill        Invoke or list skills (plan, team, deep-interview, review, verify, handoff)',
    '  tools        Built-in MCP tools (file/git/http/process) list/serve/manifest',
    '  prd          PRD workflow commands (init/status/next/validate/complete/reopen)',
    '  mcp serve    Start MCP stdio server (or inspect surfaces with --dry-run)',
    '  ask          Run Gemini advisor prompts and save artifacts',
    '  cost         Show token/cost usage summaries (daily/weekly/monthly)',
    '  sessions     List recorded OMG sessions with metadata',
    '  wait         Show Gemini rate-limit status and manage auto-resume state',
    '  verify       Run smoke/integration/reliability verification suites',
    '  version      Print omg/node/tmux/gemini version details',
    '',
    'Examples:',
    '  omg',
    '  omg --madmax',
    '  omg launch --yolo',
    '  omg setup --scope project',
    '  omg doctor --json',
    '  omg update --json',
    '  omg uninstall --json',
    '  omg extension path',
    '  omg team run --task "smoke" --backend tmux --workers 3 --dry-run',
    '  omg team status --team my-team --json',
    '  omg team resume --team my-team --max-fix-loop 1',
    '  omg team shutdown --team my-team --force --json',
    '  omg team cancel --team my-team --force --json',
    '  omg tools list --json',
    '  omg tools manifest --json',
    '  omg ask gemini --prompt "summarize this codebase"',
    '  omg cost weekly',
    '  omg sessions --limit 10',
    '  omg wait --start',
    '  omg verify',
    '  omg version --json',
  ].join('\n'));
}

export function resolveCliInvocation(args: string[]): ResolvedCliInvocation {
  const firstArg = args[0];

  if (firstArg === '--help' || firstArg === '-h') {
    return { command: 'help', launchArgs: [] };
  }

  if (firstArg === '--version' || firstArg === '-V' || firstArg === '-v') {
    return { command: 'version', launchArgs: [] };
  }

  if (!firstArg || firstArg.startsWith('-')) {
    return { command: 'launch', launchArgs: firstArg ? args : [] };
  }

  if (firstArg === 'launch') {
    return { command: 'launch', launchArgs: args.slice(1) };
  }

  return { command: firstArg, launchArgs: [] };
}

export async function runCli(argv: string[] = process.argv.slice(2), deps: CliDependencies = {}): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const env = deps.env ?? process.env;
  const io = deps.io ?? defaultIo();
  const { command, launchArgs } = resolveCliInvocation(argv);

  if (command === 'help') {
    printGlobalHelp(io);
    return 0;
  }

  if (command === 'version') {
    const { version } = await loadPackageJson();
    io.stdout(version);
    return 0;
  }

  const rest = command === 'launch' ? launchArgs : argv.slice(1);

  try {
    switch (command) {
      case 'launch': {
        const result = await executeLaunchCommand(rest, {
          cwd,
          env,
          io,
          launchRunner: deps.launch?.launchRunner,
        });
        return result.exitCode;
      }
      case 'setup': {
        const result = await executeSetupCommand(rest, {
          cwd,
          io,
          setupRunner: deps.setup?.setupRunner,
        });
        return result.exitCode;
      }

      case 'update': {
        const result = await executeUpdateCommand(rest, {
          cwd,
          io,
          updateRunner: deps.update?.updateRunner,
        });
        return result.exitCode;
      }

      case 'uninstall': {
        const result = await executeUninstallCommand(rest, {
          cwd,
          io,
          uninstallRunner: deps.uninstall?.uninstallRunner,
        });
        return result.exitCode;
      }

      case 'doctor': {
        const result = await executeDoctorCommand(rest, {
          cwd,
          env,
          io,
          probeCommand: deps.doctor?.probeCommand,
        });
        return result.exitCode;
      }

      case 'extension': {
        const [subcommand, ...extensionArgs] = rest;
        if (subcommand !== 'path') {
          io.stderr('Unknown extension subcommand. Supported: extension path');
          return 2;
        }

        const result = await executeExtensionPathCommand(extensionArgs, {
          cwd,
          env,
          io,
        });
        return result.exitCode;
      }

      case 'team': {
        const [subcommand, ...teamArgs] = rest;
        switch (subcommand) {
          case 'run': {
            const result = await executeTeamRunCommand(teamArgs, {
              cwd,
              io,
              teamRunner: deps.teamRun?.teamRunner,
            });
            return result.exitCode;
          }

          case 'status': {
            const result = await executeTeamStatusCommand(teamArgs, {
              cwd,
              io,
              statusRunner: deps.teamStatus?.statusRunner,
            });
            return result.exitCode;
          }

          case 'resume': {
            const result = await executeTeamResumeCommand(teamArgs, {
              cwd,
              io,
              resumeRunner: deps.teamResume?.resumeRunner,
            });
            return result.exitCode;
          }

          case 'shutdown': {
            const result = await executeTeamShutdownCommand(teamArgs, {
              cwd,
              io,
              shutdownRunner: deps.teamShutdown?.shutdownRunner,
            });
            return result.exitCode;
          }

          case 'cancel': {
            const result = await executeTeamCancelCommand(teamArgs, {
              cwd,
              io,
              cancelRunner: deps.teamCancel?.cancelRunner,
            });
            return result.exitCode;
          }

          default:
            io.stderr(
              'Unknown team subcommand. Supported: team run | team status | team resume | team shutdown | team cancel',
            );
            return 2;
        }
      }

      case 'worker': {
        const [subcommand, ...workerArgs] = rest;
        if (subcommand !== 'run') {
          io.stderr('Unknown worker subcommand. Supported: worker run');
          return 2;
        }
        const result = await executeWorkerRunCommand(workerArgs, { cwd, io });
        return result.exitCode;
      }

      case 'skill': {
        const result = await executeSkillCommand(rest, { cwd, io });
        return result.exitCode;
      }

      case 'prd': {
        const result = await executePrdCommand(rest, { cwd, io });
        return result.exitCode;
      }

      case 'tools': {
        const result = await executeToolsCommand(rest, {
          cwd,
          io,
          listTools: deps.tools?.listTools,
          serveTools: deps.tools?.serveTools,
        });
        return result.exitCode;
      }

      case 'hud': {
        const result = await executeHudCommand(rest, {
          cwd,
          env,
          io,
          readHudContextFn: deps.hud?.readHudContextFn,
          readHudConfigFn: deps.hud?.readHudConfigFn,
          renderHudFn: deps.hud?.renderHudFn,
        });
        return result.exitCode;
      }

      case 'mcp': {
        const [subcommand, ...mcpArgs] = rest;
        if (subcommand !== 'serve') {
          io.stderr('Unknown mcp subcommand. Supported: mcp serve');
          return 2;
        }
        const result = await executeMcpServeCommand(mcpArgs, {
          cwd,
          io,
          serveRunner: deps.mcpServe?.serveRunner,
        });
        return result.exitCode;
      }

      case 'ask': {
        const result = await executeAskCommand(rest, {
          cwd,
          io,
          env,
          runAskPrompt: deps.ask?.runAskPrompt,
          now: deps.ask?.now,
          createSessionId: deps.ask?.createSessionId,
        });
        return result.exitCode;
      }

      case 'cost': {
        const result = await executeCostCommand(rest, {
          cwd,
          io,
          now: deps.cost?.now,
        });
        return result.exitCode;
      }

      case 'sessions': {
        const result = await executeSessionsCommand(rest, {
          cwd,
          io,
        });
        return result.exitCode;
      }

      case 'wait': {
        const result = await executeWaitCommand(rest, {
          cwd,
          io,
          now: deps.wait?.now,
        });
        return result.exitCode;
      }

      case 'verify': {
        const result = await executeVerifyCommand(rest, {
          cwd,
          io,
          verifyRunner: deps.verify?.verifyRunner,
        });
        return result.exitCode;
      }

      case 'version': {
        const result = await executeVersionCommand(rest, {
          cwd,
          io,
          probeVersion: deps.version?.probeVersion,
          resolveOmgVersion: deps.version?.resolveOmgVersion,
        });
        return result.exitCode;
      }

      default:
        io.stderr(`Unknown command: ${command}`);
        printGlobalHelp(io);
        return 2;
    }
  } catch (error) {
    io.stderr(`Command failed: ${(error as Error).message}`);
    return 1;
  }
}

function resolveCommandPath(inputPath: string): string {
  try {
    return realpathSync.native(inputPath);
  } catch {
    return path.resolve(inputPath);
  }
}

const currentModulePath = resolveCommandPath(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? resolveCommandPath(process.argv[1]) : '';

if (invokedPath !== '' && currentModulePath === invokedPath) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(`Fatal: ${(error as Error).message ?? error}`);
      process.exitCode = 1;
    });
}
