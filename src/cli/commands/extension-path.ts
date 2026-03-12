import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

export const OMG_EXTENSION_PATH_ENV = 'OMG_EXTENSION_PATH';
export const EXTENSION_ROOT_RELATIVE_PATH = '.';
export const EXTENSION_MANIFEST_FILE_NAME = 'gemini-extension.json';

export type ExtensionPathSource = 'override' | 'cwd' | 'installed';

export interface ResolvedExtensionPath {
  source: ExtensionPathSource;
  path: string;
  manifestPath: string;
}

export interface ResolveExtensionPathOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  overridePath?: string;
}

export interface ExtensionPathCommandContext {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  io: CliIo;
}

interface ExtensionPathCandidate {
  source: ExtensionPathSource;
  path: string;
}

function printExtensionPathHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg extension path [--json] [--extension-path <path>]',
    '',
    'Options:',
    '  --json                     Print machine-readable path resolution output',
    '  --extension-path <path>    Explicit extension root path override',
    `  $${OMG_EXTENSION_PATH_ENV}           Environment override for extension root`,
    '  --help                     Show command help',
  ].join('\n'));
}

function formatPathForUser(cwd: string, absolutePath: string): string {
  const relativePath = path.relative(cwd, absolutePath);
  if (!relativePath || relativePath.startsWith('..')) {
    return absolutePath;
  }
  return relativePath;
}

function packageRootFromModuleUrl(moduleUrl: string = import.meta.url): string {
  const commandsDir = path.dirname(fileURLToPath(moduleUrl));
  return path.resolve(commandsDir, '..', '..', '..');
}

function buildCandidateList(options: ResolveExtensionPathOptions): {
  candidates: ExtensionPathCandidate[];
  usedOverride: string | undefined;
} {
  const env = options.env ?? process.env;
  const overrideInput = options.overridePath ?? env[OMG_EXTENSION_PATH_ENV];
  const usedOverride = typeof overrideInput === 'string' && overrideInput.trim().length > 0
    ? overrideInput
    : undefined;

  const candidates: ExtensionPathCandidate[] = [];

  if (usedOverride) {
    candidates.push({
      source: 'override',
      path: path.resolve(options.cwd, usedOverride),
    });
  }

  const installedRoot = packageRootFromModuleUrl();
  candidates.push({
    source: 'installed',
    path: path.join(installedRoot, EXTENSION_ROOT_RELATIVE_PATH),
  });

  candidates.push({
    source: 'cwd',
    path: path.join(options.cwd, EXTENSION_ROOT_RELATIVE_PATH),
  });

  return {
    candidates,
    usedOverride,
  };
}

async function hasExtensionManifest(extensionRoot: string): Promise<boolean> {
  const manifestPath = path.join(extensionRoot, EXTENSION_MANIFEST_FILE_NAME);

  try {
    await fs.access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveExtensionPath(
  options: ResolveExtensionPathOptions,
): Promise<ResolvedExtensionPath> {
  const { candidates, usedOverride } = buildCandidateList(options);

  for (const candidate of candidates) {
    if (await hasExtensionManifest(candidate.path)) {
      return {
        source: candidate.source,
        path: candidate.path,
        manifestPath: path.join(candidate.path, EXTENSION_MANIFEST_FILE_NAME),
      };
    }

    if (candidate.source === 'override' && usedOverride) {
      throw new Error(
        [
          `Explicit extension override is invalid: ${usedOverride}`,
          `Expected manifest at: ${path.join(candidate.path, EXTENSION_MANIFEST_FILE_NAME)}`,
          `Check ${OMG_EXTENSION_PATH_ENV} or --extension-path value.`,
        ].join('\n'),
      );
    }
  }

  const checkedCandidates = candidates
    .map((candidate) => {
      const manifestPath = path.join(candidate.path, EXTENSION_MANIFEST_FILE_NAME);
      return `- [${candidate.source}] ${manifestPath}`;
    })
    .join('\n');

  throw new Error(
    [
      'Unable to resolve oh-my-gemini extension path.',
      'Checked manifest candidates:',
      checkedCandidates,
      '',
      `Set ${OMG_EXTENSION_PATH_ENV}=<path> or pass --extension-path <path>.`,
    ].join('\n'),
  );
}

export async function executeExtensionPathCommand(
  argv: string[],
  context: ExtensionPathCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printExtensionPathHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'help',
    'h',
    'json',
    'extension-path',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    printExtensionPathHelp(io);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    printExtensionPathHelp(io);
    return { exitCode: 2 };
  }

  const overridePath = getStringOption(parsed.options, ['extension-path']);

  try {
    const resolved = await resolveExtensionPath({
      cwd: context.cwd,
      env: context.env,
      overridePath,
    });

    if (hasFlag(parsed.options, ['json'])) {
      io.stdout(
        JSON.stringify(
          {
            source: resolved.source,
            path: resolved.path,
            manifestPath: resolved.manifestPath,
          },
          null,
          2,
        ),
      );
    } else {
      io.stdout(formatPathForUser(context.cwd, resolved.path));
    }

    return { exitCode: 0 };
  } catch (error) {
    io.stderr((error as Error).message);
    return { exitCode: 1 };
  }
}
