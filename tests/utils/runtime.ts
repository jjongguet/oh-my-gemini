import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

export const repoRoot = path.resolve(thisDir, '..', '..');
const srcCliEntrypoint = path.join(repoRoot, 'src', 'cli', 'index.ts');
const distCliEntrypoint = path.join(repoRoot, 'dist', 'cli', 'index.js');
const tsxLoaderEntrypoint = path.join(
  repoRoot,
  'node_modules',
  'tsx',
  'dist',
  'loader.mjs'
);

export function cliEntrypointExists(): boolean {
  return existsSync(srcCliEntrypoint) || existsSync(distCliEntrypoint);
}

export function hasCommand(commandName: string): boolean {
  const check = spawnSync('bash', ['-lc', `command -v ${escapeShellToken(commandName)}`], {
    stdio: 'ignore'
  });

  return check.status === 0;
}

export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
): CommandResult {
  const result = spawnSync(command, args, {
    ...options,
    encoding: 'utf8'
  });

  return {
    status: result.status,
    stdout: (result.stdout as string | undefined) ?? '',
    stderr: (result.stderr as string | undefined) ?? ''
  };
}

export function runOmg(
  args: string[],
  options: SpawnSyncOptions = {}
): CommandResult {
  const entrypoint = existsSync(srcCliEntrypoint)
    ? srcCliEntrypoint
    : distCliEntrypoint;

  if (!existsSync(entrypoint)) {
    return {
      status: 127,
      stdout: '',
      stderr: `CLI entrypoint not found. Checked: ${srcCliEntrypoint}, ${distCliEntrypoint}`
    };
  }

  const nodeArgs = entrypoint === distCliEntrypoint
    ? [entrypoint, ...args]
    : ['--import', tsxLoaderEntrypoint, entrypoint, ...args];

  return runCommand(process.execPath, nodeArgs, options);
}

export function createTempDir(prefix = 'omg-test-'): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeDir(targetDir: string): void {
  rmSync(targetDir, { recursive: true, force: true });
}

export async function readTrackedFiles(
  rootDir: string,
  relativePaths: readonly string[]
): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    snapshot[relativePath] = await fs.readFile(absolutePath, 'utf8');
  }

  return snapshot;
}

function escapeShellToken(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
