import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function killProcessTree(
  pid: number,
  signal: NodeJS.Signals = 'SIGTERM',
): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  if (process.platform === 'win32') {
    return killProcessTreeWindows(pid, signal === 'SIGKILL');
  }

  return killProcessTreeUnix(pid, signal);
}

async function killProcessTreeWindows(pid: number, force: boolean): Promise<boolean> {
  try {
    const args = ['/T', '/PID', String(pid)];
    if (force) {
      args.unshift('/F');
    }

    await execFileAsync('taskkill', args, {
      timeout: 5_000,
      windowsHide: true,
    });

    return true;
  } catch {
    return false;
  }
}

function killProcessTreeUnix(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseEpochTimestamp(raw: string): number | undefined {
  const match = raw.trim().match(/-?\d+/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function getProcessStartTimeWindows(pid: number): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p -and $p.StartTime) { [DateTimeOffset]$p.StartTime | ForEach-Object { $_.ToUnixTimeMilliseconds() } }`,
      ],
      {
        timeout: 5_000,
        windowsHide: true,
      },
    );

    return parseEpochTimestamp(stdout);
  } catch {
    return undefined;
  }
}

async function getProcessStartTimeMacOs(pid: number): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'lstart='], {
      env: {
        ...process.env,
        LC_ALL: 'C',
      },
    });

    const parsed = new Date(stdout.trim()).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
  } catch {
    return undefined;
  }
}

async function getProcessStartTimeLinux(pid: number): Promise<number | undefined> {
  try {
    const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf8');
    const closeParen = stat.lastIndexOf(')');
    if (closeParen === -1) {
      return undefined;
    }

    const fields = stat.substring(closeParen + 2).split(' ');
    const startTime = Number.parseInt(fields[19] ?? '', 10);
    return Number.isFinite(startTime) ? startTime : undefined;
  } catch {
    return undefined;
  }
}

export async function getProcessStartTime(pid: number): Promise<number | undefined> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return undefined;
  }

  switch (process.platform) {
    case 'win32':
      return getProcessStartTimeWindows(pid);
    case 'darwin':
      return getProcessStartTimeMacOs(pid);
    case 'linux':
      return getProcessStartTimeLinux(pid);
    default:
      return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gracefulKill(
  pid: number,
  gracePeriodMs: number = 5_000,
): Promise<'graceful' | 'forced' | 'failed'> {
  if (!isProcessAlive(pid)) {
    return 'graceful';
  }

  await killProcessTree(pid, 'SIGTERM');

  const deadline = Date.now() + Math.max(gracePeriodMs, 0);
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return 'graceful';
    }

    await sleep(100);
  }

  await killProcessTree(pid, 'SIGKILL');
  await sleep(300);

  return isProcessAlive(pid) ? 'failed' : 'forced';
}
