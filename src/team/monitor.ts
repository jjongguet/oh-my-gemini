import type {
  TeamSnapshot,
  WorkerRuntimeStatus,
  WorkerSnapshot,
} from './types.js';

export interface TeamHealthMonitorOptions {
  now?: Date;
  watchdogMs?: number;
  nonReportingMs?: number;
}

export interface TeamHealthReport {
  healthy: boolean;
  deadWorkers: string[];
  nonReportingWorkers: string[];
  watchdogExpired: boolean;
  snapshotAgeMs?: number;
  summary: string;
}

const DEFAULT_WATCHDOG_MS = 90_000;
const DEFAULT_NON_REPORTING_MS = 180_000;
const HEARTBEAT_REQUIRED_STATUSES: ReadonlySet<WorkerRuntimeStatus> = new Set([
  'running',
  'blocked',
  'unknown',
]);

function isWorkerDead(worker: WorkerSnapshot): boolean {
  return worker.status === 'failed';
}

function requiresHeartbeat(worker: WorkerSnapshot): boolean {
  return HEARTBEAT_REQUIRED_STATUSES.has(worker.status);
}

function isWorkerNonReporting(
  worker: WorkerSnapshot,
  now: Date,
  nonReportingMs: number,
): boolean {
  if (!requiresHeartbeat(worker)) {
    return false;
  }

  if (!worker.lastHeartbeatAt) {
    return true;
  }

  const heartbeatAt = Date.parse(worker.lastHeartbeatAt);
  if (Number.isNaN(heartbeatAt)) {
    return true;
  }

  return now.getTime() - heartbeatAt > nonReportingMs;
}

/**
 * Evaluate snapshot health for Phase 2 reliability hardening:
 * - dead worker detection
 * - heartbeat watchdog thresholding
 * - non-reporting worker identification
 */
export function evaluateTeamHealth(
  snapshot: TeamSnapshot,
  options: TeamHealthMonitorOptions = {},
): TeamHealthReport {
  const now = options.now ?? new Date();
  const watchdogMs = options.watchdogMs ?? DEFAULT_WATCHDOG_MS;
  const nonReportingMs = options.nonReportingMs ?? DEFAULT_NON_REPORTING_MS;

  const deadWorkers = snapshot.workers
    .filter((worker) => isWorkerDead(worker))
    .map((worker) => worker.workerId);

  const nonReportingWorkers = snapshot.workers
    .filter((worker) => isWorkerNonReporting(worker, now, nonReportingMs))
    .map((worker) => worker.workerId);

  const parsedSnapshotTimestamp = Date.parse(snapshot.updatedAt);
  const snapshotAgeMs = Number.isNaN(parsedSnapshotTimestamp)
    ? undefined
    : Math.max(0, now.getTime() - parsedSnapshotTimestamp);
  const watchdogExpired =
    snapshotAgeMs === undefined ? true : snapshotAgeMs > watchdogMs;

  const summaryParts: string[] = [];
  if (deadWorkers.length > 0) {
    summaryParts.push(`dead workers: ${deadWorkers.join(', ')}`);
  }
  if (nonReportingWorkers.length > 0) {
    summaryParts.push(`non-reporting workers: ${nonReportingWorkers.join(', ')}`);
  }
  if (snapshotAgeMs === undefined) {
    summaryParts.push(
      `watchdog timestamp invalid (snapshot.updatedAt=${JSON.stringify(snapshot.updatedAt)})`,
    );
  } else if (watchdogExpired) {
    summaryParts.push(
      `watchdog threshold exceeded (${Math.round(snapshotAgeMs / 1000)}s)`,
    );
  }
  if (snapshot.status === 'failed') {
    summaryParts.push(
      snapshot.failureReason ?? 'runtime backend marked snapshot as failed',
    );
  }

  const healthy =
    deadWorkers.length === 0 &&
    nonReportingWorkers.length === 0 &&
    !watchdogExpired &&
    snapshot.status !== 'failed';

  return {
    healthy,
    deadWorkers,
    nonReportingWorkers,
    watchdogExpired,
    snapshotAgeMs,
    summary:
      summaryParts.join(' | ') || 'healthy: no dead/non-reporting workers detected',
  };
}
