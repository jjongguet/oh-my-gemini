import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { CliIo, CommandExecutionResult } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';

export interface CleanupCommandContext {
  cwd: string;
  io: CliIo;
}

const STALE_DIR_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const STALE_HEARTBEAT_THRESHOLD_MS = 90 * 1000; // 90 seconds
const TMUX_SESSION_PATTERN = /^(omp-team-|omp-team-)/;

function printCleanupHelp(io: CliIo): void {
  io.stdout(
    [
      'Usage: omp cleanup [options]',
      '',
      'Kill orphaned workers and clean stale state.',
      '',
      'Options:',
      '  --dry-run   Preview what would be cleaned without making changes',
      '  --help      Show command help',
    ].join('\n'),
  );
}

function listTmuxSessions(io: CliIo): string[] {
  try {
    const output = execSync("tmux list-sessions -F '#{session_name}'", {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    // tmux not running or no sessions
    return [];
  }
}

function killTmuxSession(name: string, io: CliIo): void {
  try {
    execSync(`tmux kill-session -t ${name}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    io.stdout(`  Killed tmux session: ${name}`);
  } catch (error) {
    io.stderr(`  Failed to kill tmux session ${name}: ${(error as Error).message}`);
  }
}

interface StaleDir {
  dirPath: string;
  lastModifiedMs: number;
}

function findStaleDirs(cwd: string): StaleDir[] {
  const teamStateRoot = path.join(cwd, '.omp', 'state', 'team');
  const stale: StaleDir[] = [];
  const now = Date.now();

  if (!fs.existsSync(teamStateRoot)) {
    return stale;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(teamStateRoot);
  } catch {
    return stale;
  }

  for (const entry of entries) {
    const dirPath = path.join(teamStateRoot, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(dirPath);
    } catch {
      continue;
    }

    if (!stat.isDirectory()) {
      continue;
    }

    const ageMs = now - stat.mtimeMs;
    if (ageMs > STALE_DIR_THRESHOLD_MS) {
      stale.push({ dirPath, lastModifiedMs: stat.mtimeMs });
    }
  }

  return stale;
}

interface StaleHeartbeat {
  filePath: string;
  lastModifiedMs: number;
}

function findStaleHeartbeats(cwd: string): StaleHeartbeat[] {
  const teamStateRoot = path.join(cwd, '.omp', 'state', 'team');
  const stale: StaleHeartbeat[] = [];
  const now = Date.now();

  if (!fs.existsSync(teamStateRoot)) {
    return stale;
  }

  let teamDirs: string[];
  try {
    teamDirs = fs.readdirSync(teamStateRoot);
  } catch {
    return stale;
  }

  for (const teamDir of teamDirs) {
    const workersDir = path.join(teamStateRoot, teamDir, 'workers');
    if (!fs.existsSync(workersDir)) {
      continue;
    }

    let workerEntries: string[];
    try {
      workerEntries = fs.readdirSync(workersDir);
    } catch {
      continue;
    }

    for (const workerEntry of workerEntries) {
      const filePath = path.join(workersDir, workerEntry);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        continue;
      }

      const ageMs = now - stat.mtimeMs;
      if (ageMs > STALE_HEARTBEAT_THRESHOLD_MS) {
        stale.push({ filePath, lastModifiedMs: stat.mtimeMs });
      }
    }
  }

  return stale;
}

function removePath(filePath: string, io: CliIo): void {
  try {
    fs.rmSync(filePath, { recursive: true, force: true });
    io.stdout(`  Removed: ${filePath}`);
  } catch (error) {
    io.stderr(`  Failed to remove ${filePath}: ${(error as Error).message}`);
  }
}

export async function executeCleanupCommand(
  argv: string[],
  context: CleanupCommandContext,
): Promise<CommandExecutionResult> {
  const { io, cwd } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printCleanupHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, ['dry-run', 'help', 'h']);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}.`);
    return { exitCode: 2 };
  }

  const dryRun = hasFlag(parsed.options, ['dry-run']);

  if (dryRun) {
    io.stdout('Dry-run mode: no changes will be made.\n');
  }

  let cleanedCount = 0;

  // 1. Tmux sessions matching omp-team-* or omp-team-*
  const sessions = listTmuxSessions(io);
  const matchingSessions = sessions.filter((s) => TMUX_SESSION_PATTERN.test(s));

  if (matchingSessions.length > 0) {
    io.stdout('Orphaned tmux sessions:');
    for (const session of matchingSessions) {
      io.stdout(`  ${session}`);
      if (!dryRun) {
        killTmuxSession(session, io);
      }
      cleanedCount += 1;
    }
  } else {
    io.stdout('No orphaned tmux sessions found.');
  }

  // 2. Stale team state directories (>1 hour)
  const staleDirs = findStaleDirs(cwd);

  if (staleDirs.length > 0) {
    io.stdout('\nStale team state directories (>1 hour):');
    for (const { dirPath, lastModifiedMs } of staleDirs) {
      const ageMinutes = Math.floor((Date.now() - lastModifiedMs) / 60_000);
      io.stdout(`  ${dirPath} (last modified ${ageMinutes}m ago)`);
      if (!dryRun) {
        removePath(dirPath, io);
      }
      cleanedCount += 1;
    }
  } else {
    io.stdout('\nNo stale team state directories found.');
  }

  // 3. Stale heartbeat files (>90 seconds)
  const staleHeartbeats = findStaleHeartbeats(cwd);

  if (staleHeartbeats.length > 0) {
    io.stdout('\nStale heartbeat files (>90 seconds):');
    for (const { filePath, lastModifiedMs } of staleHeartbeats) {
      const ageSeconds = Math.floor((Date.now() - lastModifiedMs) / 1000);
      io.stdout(`  ${filePath} (last modified ${ageSeconds}s ago)`);
      if (!dryRun) {
        removePath(filePath, io);
      }
      cleanedCount += 1;
    }
  } else {
    io.stdout('\nNo stale heartbeat files found.');
  }

  io.stdout('');
  if (dryRun) {
    io.stdout(`Dry-run complete. ${cleanedCount} item(s) would be cleaned.`);
  } else {
    io.stdout(`Cleanup complete. ${cleanedCount} item(s) processed.`);
  }

  return { exitCode: 0 };
}
