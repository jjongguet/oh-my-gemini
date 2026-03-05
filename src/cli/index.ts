#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeDoctorCommand, type DoctorCommandContext } from './commands/doctor.js';
import { executeHudCommand, type HudCommandContext } from './commands/hud.js';
import { executeMcpServeCommand, type McpServeCommandContext } from './commands/mcp.js';
import {
  executeExtensionPathCommand,
  type ExtensionPathCommandContext,
} from './commands/extension-path.js';
import { executeSetupCommand, type SetupCommandContext } from './commands/setup.js';
import {
  executeTeamResumeCommand,
  type TeamResumeCommandContext,
} from './commands/team-resume.js';
import { executeTeamRunCommand, type TeamRunCommandContext } from './commands/team-run.js';
import {
  executeTeamShutdownCommand,
  type TeamShutdownCommandContext,
} from './commands/team-shutdown.js';
import {
  executeTeamStatusCommand,
  type TeamStatusCommandContext,
} from './commands/team-status.js';
import { executeVerifyCommand, type VerifyCommandContext } from './commands/verify.js';
import { executeWorkerRunCommand } from './commands/worker-run.js';
import { executeSkillCommand } from './commands/skill.js';
import { executeToolsCommand, type ToolsCommandContext } from './commands/tools.js';
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

export interface CliDependencies {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  io?: CliIo;
  setup?: Omit<SetupCommandContext, 'cwd' | 'io'>;
  doctor?: Omit<DoctorCommandContext, 'cwd' | 'io'>;
  extensionPath?: Omit<ExtensionPathCommandContext, 'cwd' | 'io' | 'env'>;
  teamRun?: Omit<TeamRunCommandContext, 'cwd' | 'io'>;
  teamStatus?: Omit<TeamStatusCommandContext, 'cwd' | 'io'>;
  teamResume?: Omit<TeamResumeCommandContext, 'cwd' | 'io'>;
  teamShutdown?: Omit<TeamShutdownCommandContext, 'cwd' | 'io'>;
  verify?: Omit<VerifyCommandContext, 'cwd' | 'io'>;
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
    '  omg <command> [options]',
    '',
    'Post-install contract:',
    '  After npm install -g oh-my-gemini-sisyphus, run setup to apply local files:',
    '  omg setup --scope project',
    '  # equivalent: oh-my-gemini setup --scope project',
    '',
    'Commands:',
    '  setup        Configure project/user setup artifacts and persisted scope',
    '  doctor       Diagnose runtime/tooling/state prerequisites with optional safe fixes',
    '  extension    Resolve extension package assets (for example: extension path)',
    '  team run     Execute team orchestration (tmux default backend)',
    '  team status  Inspect persisted team runtime/phase/task health',
    '  team resume  Resume team execution from persisted run metadata',
    '  team shutdown  Shutdown persisted runtime handle (graceful by default)',
    '  worker run   Worker bootstrap (runs inside tmux panes)',
    '  skill        Invoke or list skills (plan, team, deep-interview, review, verify, handoff)',
    '  tools        Built-in MCP tools (file/git/http/process) list/serve/manifest',
    '  prd          PRD workflow commands (init/status/next/validate/complete/reopen)',
    '  mcp serve    Start MCP stdio server (or inspect surfaces with --dry-run)',
    '  verify       Run smoke/integration/reliability verification suites',
    '',
    'Examples:',
    '  omg setup --scope project',
    '  omg doctor --json',
    '  omg extension path',
    '  omg team run --task "smoke" --backend tmux --workers 3 --dry-run',
    '  omg team status --team my-team --json',
    '  omg team resume --team my-team --max-fix-loop 1',
    '  omg team shutdown --team my-team --force --json',
    '  omg tools list --json',
    '  omg tools manifest --json',
    '  omg verify',
  ].join('\n'));
}

export async function runCli(argv: string[] = process.argv.slice(2), deps: CliDependencies = {}): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const env = deps.env ?? process.env;
  const io = deps.io ?? defaultIo();

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printGlobalHelp(io);
    return 0;
  }

  if (argv[0] === '--version' || argv[0] === '-V') {
    const { version } = await loadPackageJson();
    io.stdout(version);
    return 0;
  }

  const [command, ...rest] = argv;

  try {
    switch (command) {
      case 'setup': {
        const result = await executeSetupCommand(rest, {
          cwd,
          io,
          setupRunner: deps.setup?.setupRunner,
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

          default:
            io.stderr(
              'Unknown team subcommand. Supported: team run | team status | team resume | team shutdown',
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

      case 'tools': {
        const result = await executeToolsCommand(rest, {
          cwd,
          io,
          listTools: deps.tools?.listTools,
          serveTools: deps.tools?.serveTools,
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
