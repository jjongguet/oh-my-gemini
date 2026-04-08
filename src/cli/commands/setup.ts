import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatSetupResult, runSetup } from '../../installer/index.js';
import { isSetupScope, type SetupScope } from '../../installer/scopes.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import { findUnknownOptions, getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface SetupCommandContext {
  cwd: string;
  io: CliIo;
  setupRunner?: typeof runSetup;
  linkGeminiExtension?: (input: {
    packageRoot: string;
    cwd: string;
    jsonOutput: boolean;
  }) => boolean;
  enableGeminiExtension?: (input: {
    cwd: string;
  }) => void;
}

/**
 * Remove skill folders from ~/.agents/skills/ that conflict with the
 * oh-my-product extension's built-in skills.  Gemini CLI loads skills from
 * both locations, and duplicates cause "Skill conflict detected" warnings.
 */
export function cleanLegacySkillConflicts(
  packageRoot: string,
  io: CliIo,
  overrideUserSkillsDir?: string,
): string[] {
  const extensionSkillsDir = path.join(packageRoot, 'skills');
  const userSkillsDir = overrideUserSkillsDir ?? path.join(homedir(), '.agents', 'skills');

  if (!existsSync(extensionSkillsDir) || !existsSync(userSkillsDir)) {
    return [];
  }

  const extensionSkillNames = new Set(
    readdirSync(extensionSkillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );

  const removed: string[] = [];

  for (const entry of readdirSync(userSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!extensionSkillNames.has(entry.name)) continue;

    const conflictPath = path.join(userSkillsDir, entry.name);
    try {
      rmSync(conflictPath, { recursive: true, force: true });
      removed.push(entry.name);
    } catch {
      io.stderr(`Warning: could not remove legacy skill conflict: ${conflictPath}`);
    }
  }

  return removed;
}

function printSetupHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp setup [--scope <project|user>] [--dry-run] [--json]',
    '',
    'Post-install contract:',
    '  After npm install -g oh-my-product, run setup to apply local files.',
    '  Supported entrypoints: omp setup ... / oh-my-product setup ...',
    '',
    'Options:',
    '  --scope <scope>   Installation scope (project | user)',
    '  --dry-run         Show planned actions without writing files',
    '  --json            Print full result as JSON',
    '  --help            Show command help',
  ].join('\n'));
}

function defaultLinkGeminiExtension(input: {
  packageRoot: string;
  cwd: string;
  jsonOutput: boolean;
}): boolean {
  try {
    execFileSync('gemini', ['extensions', 'link', input.packageRoot], {
      cwd: input.cwd,
      stdio: input.jsonOutput ? 'pipe' : 'inherit',
      timeout: 30_000,
    });
    return true;
  } catch {
    return false;
  }
}

function defaultEnableGeminiExtension(input: { cwd: string }): void {
  try {
    execFileSync('gemini', ['extensions', 'enable', 'oh-my-product'], {
      cwd: input.cwd,
      stdio: 'pipe',
      timeout: 15_000,
    });
  } catch {
    // 'enable' subcommand may not exist in older Gemini CLI versions — ignore
  }
}

export async function executeSetupCommand(
  argv: string[],
  context: SetupCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printSetupHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'scope',
    'dry-run',
    'json',
    'help',
    'h',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const scopeRaw = getStringOption(parsed.options, ['scope']);
  let scope: SetupScope | undefined;

  if (scopeRaw !== undefined) {
    if (!isSetupScope(scopeRaw)) {
      io.stderr(`Invalid --scope value: ${scopeRaw}. Expected: project | user`);
      return { exitCode: 2 };
    }
    scope = scopeRaw;
  }

  if (scope === 'user') {
    io.stderr('Warning: --scope user is not yet implemented. Falling back to project scope.');
    scope = 'project';
  }

  const dryRun = hasFlag(parsed.options, ['dry-run']);
  const jsonOutput = hasFlag(parsed.options, ['json']);

  const setupRunner = context.setupRunner ?? runSetup;
  const linkGeminiExtension = context.linkGeminiExtension ?? defaultLinkGeminiExtension;
  const enableGeminiExtension = context.enableGeminiExtension ?? defaultEnableGeminiExtension;

  const result = await setupRunner({
    cwd: context.cwd,
    scope,
    dryRun,
  });

  if (!dryRun) {
    const packageRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
    );

    let linkOk = false;
    linkOk = linkGeminiExtension({
      packageRoot,
      cwd: context.cwd,
      jsonOutput,
    });

    // Clean up legacy skill folders in ~/.agents/skills/ that now conflict
    // with the extension's built-in skills — always, regardless of link result.
    const removedSkills = cleanLegacySkillConflicts(packageRoot, io);

    if (linkOk) {
      enableGeminiExtension({ cwd: context.cwd });

      if (!jsonOutput) {
        io.stdout('Gemini extension linked successfully. Restart Gemini CLI for /omp:* commands to appear.');
      }
    } else {
      io.stderr(
        'Warning: could not auto-link Gemini extension.\n' +
        `  Run manually: gemini extensions link ${packageRoot}\n` +
        '  Then ensure it is enabled: gemini extensions list',
      );
    }

    if (!jsonOutput && removedSkills.length > 0) {
      io.stdout(
        `Cleaned ${removedSkills.length} legacy skill conflict(s): ${removedSkills.join(', ')}`,
      );
    }
  }

  if (jsonOutput) {
    io.stdout(JSON.stringify(result, null, 2));
  } else {
    io.stdout(formatSetupResult(result));
  }

  return {
    exitCode: 0,
  };
}
