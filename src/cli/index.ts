#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeDoctorCommand, type DoctorCommandContext } from './commands/doctor.js';
import {
  executeExtensionPathCommand,
  type ExtensionPathCommandContext,
} from './commands/extension-path.js';
import { executeSetupCommand, type SetupCommandContext } from './commands/setup.js';
import { executeTeamRunCommand, type TeamRunCommandContext } from './commands/team-run.js';
import { executeVerifyCommand, type VerifyCommandContext } from './commands/verify.js';
import type { CliIo } from './types.js';

export interface CliDependencies {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  io?: CliIo;
  setup?: Omit<SetupCommandContext, 'cwd' | 'io'>;
  doctor?: Omit<DoctorCommandContext, 'cwd' | 'io'>;
  extensionPath?: Omit<ExtensionPathCommandContext, 'cwd' | 'io' | 'env'>;
  teamRun?: Omit<TeamRunCommandContext, 'cwd' | 'io'>;
  verify?: Omit<VerifyCommandContext, 'cwd' | 'io'>;
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
    'Commands:',
    '  setup        Configure project/user setup artifacts and persisted scope',
    '  doctor       Diagnose runtime/tooling/state prerequisites with optional safe fixes',
    '  extension    Resolve extension package assets (for example: extension path)',
    '  team run     Execute team orchestration (tmux default backend)',
    '  verify       Run smoke/integration/reliability verification suites',
    '',
    'Examples:',
    '  omg setup --scope project',
    '  omg doctor --json',
    '  omg extension path',
    '  omg team run --task "smoke" --backend tmux --workers 3 --dry-run',
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
        if (subcommand !== 'run') {
          io.stderr('Unknown team subcommand. Supported: team run');
          return 2;
        }

        const result = await executeTeamRunCommand(teamArgs, {
          cwd,
          io,
          teamRunner: deps.teamRun?.teamRunner,
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
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
