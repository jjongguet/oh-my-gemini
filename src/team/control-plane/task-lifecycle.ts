import { createHash, randomUUID } from 'node:crypto';

import {
  CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
  TeamStateStore,
  type PersistedTaskRecord,
  type PersistedTaskStatus,
} from '../../state/index.js';
import {
  normalizeRequiredString,
  normalizeTaskIdentifier,
  normalizeTeamName,
  normalizeWorkerName,
} from './identifiers.js';
import {
  CONTROL_PLANE_FAILURE_CODES,
  createControlPlaneFailure,
} from './failure-taxonomy.js';

export interface TaskControlPlaneOptions {
  stateStore?: TeamStateStore;
  defaultLeaseMs?: number;
  now?: () => Date;
}

export interface ClaimTaskInput {
  teamName: string;
  taskId: string;
  worker: string;
  expectedVersion?: number;
  leaseMs?: number;
}

export interface ClaimTaskResult {
  task: PersistedTaskRecord;
  claimToken: string;
}

export interface TransitionTaskInput {
  teamName: string;
  taskId: string;
  worker: string;
  claimToken: string;
  from: PersistedTaskStatus;
  to: PersistedTaskStatus;
  result?: string;
  error?: string;
}

export interface ReleaseTaskClaimInput {
  teamName: string;
  taskId: string;
  worker: string;
  claimToken: string;
  toStatus?: 'pending' | 'blocked' | 'unknown';
}

const TERMINAL_TASK_STATUSES = new Set<PersistedTaskStatus>([
  'completed',
  'failed',
  'cancelled',
  'canceled',
]);

const DEFAULT_TASK_LEASE_MS = 15 * 60 * 1000;
const TASK_AUDIT_REASON_CODES = {
  CLAIM_ACCEPTED: 'OMG_CP_TASK_CLAIM_ACCEPTED',
  TRANSITION_COMPLETED: 'OMG_CP_TASK_TRANSITION_COMPLETED',
  TRANSITION_FAILED: 'OMG_CP_TASK_TRANSITION_FAILED',
  TRANSITION_CANCELLED: 'OMG_CP_TASK_TRANSITION_CANCELLED',
  TRANSITION_CANCELED: 'OMG_CP_TASK_TRANSITION_CANCELED',
  TRANSITION_BLOCKED: 'OMG_CP_TASK_TRANSITION_BLOCKED',
  TRANSITION_PENDING: 'OMG_CP_TASK_TRANSITION_PENDING',
  TRANSITION_IN_PROGRESS: 'OMG_CP_TASK_TRANSITION_IN_PROGRESS',
  TRANSITION_UNKNOWN: 'OMG_CP_TASK_TRANSITION_UNKNOWN',
  RELEASE_PENDING: 'OMG_CP_TASK_RELEASE_PENDING',
  RELEASE_BLOCKED: 'OMG_CP_TASK_RELEASE_BLOCKED',
  RELEASE_UNKNOWN: 'OMG_CP_TASK_RELEASE_UNKNOWN',
} as const;

function parseLeaseTimestamp(isoTimestamp: string | undefined): number {
  if (!isoTimestamp) {
    return Number.NaN;
  }

  const parsed = Date.parse(isoTimestamp);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeLeaseMs(rawLeaseMs: number | undefined, fallback: number): number {
  if (rawLeaseMs === undefined) {
    return fallback;
  }

  if (!Number.isInteger(rawLeaseMs) || rawLeaseMs <= 0) {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.INVALID_LEASE_MS,
      `Invalid leaseMs value: ${rawLeaseMs}. Expected a positive integer.`,
    );
  }

  return rawLeaseMs;
}

function isTerminalTaskStatus(status: PersistedTaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.has(status);
}

function isClaimActive(task: PersistedTaskRecord, now: Date): boolean {
  const leaseUntil = parseLeaseTimestamp(task.claim?.leasedUntil);
  return Number.isFinite(leaseUntil) && leaseUntil > now.getTime();
}

function readTaskDependencies(task: PersistedTaskRecord): string[] {
  const collected = [
    ...(task.dependsOn ?? []),
    ...(task.depends_on ?? []),
  ];

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const dependency of collected) {
    const normalized = normalizeTaskIdentifier(dependency);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function createClaimTokenDigest(claimToken: string): string {
  return createHash('sha256').update(claimToken).digest('hex').slice(0, 16);
}

function reasonCodeForTransition(to: PersistedTaskStatus): string {
  switch (to) {
    case 'completed':
      return TASK_AUDIT_REASON_CODES.TRANSITION_COMPLETED;
    case 'failed':
      return TASK_AUDIT_REASON_CODES.TRANSITION_FAILED;
    case 'cancelled':
      return TASK_AUDIT_REASON_CODES.TRANSITION_CANCELLED;
    case 'canceled':
      return TASK_AUDIT_REASON_CODES.TRANSITION_CANCELED;
    case 'blocked':
      return TASK_AUDIT_REASON_CODES.TRANSITION_BLOCKED;
    case 'pending':
      return TASK_AUDIT_REASON_CODES.TRANSITION_PENDING;
    case 'in_progress':
      return TASK_AUDIT_REASON_CODES.TRANSITION_IN_PROGRESS;
    case 'unknown':
    default:
      return TASK_AUDIT_REASON_CODES.TRANSITION_UNKNOWN;
  }
}

function reasonCodeForRelease(toStatus: 'pending' | 'blocked' | 'unknown'): string {
  switch (toStatus) {
    case 'blocked':
      return TASK_AUDIT_REASON_CODES.RELEASE_BLOCKED;
    case 'unknown':
      return TASK_AUDIT_REASON_CODES.RELEASE_UNKNOWN;
    case 'pending':
    default:
      return TASK_AUDIT_REASON_CODES.RELEASE_PENDING;
  }
}

export class TaskControlPlane {
  private readonly stateStore: TeamStateStore;
  private readonly defaultLeaseMs: number;
  private readonly now: () => Date;

  constructor(options: TaskControlPlaneOptions = {}) {
    this.stateStore = options.stateStore ?? new TeamStateStore();
    this.defaultLeaseMs = normalizeLeaseMs(options.defaultLeaseMs, DEFAULT_TASK_LEASE_MS);
    this.now = options.now ?? (() => new Date());
  }

  async claimTask(input: ClaimTaskInput): Promise<ClaimTaskResult> {
    const teamName = normalizeTeamName(input.teamName);
    const taskId = normalizeTaskIdentifier(input.taskId);
    const worker = normalizeWorkerName('worker', input.worker);
    const now = this.now();
    const leaseMs = normalizeLeaseMs(input.leaseMs, this.defaultLeaseMs);

    const task = await this.requireTask(teamName, taskId);

    if (isTerminalTaskStatus(task.status)) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_TERMINAL,
        `Task ${task.id} is terminal (${task.status}) and cannot be claimed.`,
      );
    }

    await this.assertDependenciesCompleted(teamName, task);

    if (task.claim && isClaimActive(task, now)) {
      if (task.claim.owner !== worker) {
        throw createControlPlaneFailure(
          CONTROL_PLANE_FAILURE_CODES.TASK_ALREADY_CLAIMED,
          `Task ${task.id} is already claimed by ${task.claim.owner} until ${task.claim.leasedUntil}.`,
        );
      }

      // Guardrail: idempotent re-claim by the same worker should reuse existing token.
      return {
        task,
        claimToken: task.claim.token,
      };
    }

    const claimToken = randomUUID();
    const leasedUntil = new Date(now.getTime() + leaseMs).toISOString();

    const persistedTask = await this.stateStore.writeTask(
      teamName,
      {
        id: task.id,
        subject: task.subject,
        status: 'in_progress',
        owner: worker,
        claim: {
          owner: worker,
          token: claimToken,
          leasedUntil,
        },
      },
      {
        expectedVersion: input.expectedVersion ?? task.version,
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      },
    );

    await this.stateStore.appendTaskAuditEvent(teamName, {
      taskId: task.id,
      action: 'claim',
      worker,
      fromStatus: task.status,
      toStatus: 'in_progress',
      reasonCode: TASK_AUDIT_REASON_CODES.CLAIM_ACCEPTED,
      claimTokenDigest: createClaimTokenDigest(claimToken),
      leasedUntil,
      metadata: {
        leaseMs,
        expectedVersion: input.expectedVersion ?? task.version,
        taskVersion: persistedTask.version,
      },
    });

    return {
      task: persistedTask,
      claimToken,
    };
  }

  async transitionTaskStatus(input: TransitionTaskInput): Promise<PersistedTaskRecord> {
    const teamName = normalizeTeamName(input.teamName);
    const taskId = normalizeTaskIdentifier(input.taskId);
    const worker = normalizeWorkerName('worker', input.worker);
    const claimToken = normalizeRequiredString('claimToken', input.claimToken);
    const from = input.from;
    const to = input.to;
    const now = this.now();

    const task = await this.requireTask(teamName, taskId);
    this.assertClaim(task, worker, claimToken, now);

    if (task.status !== from) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_TRANSITION_FROM_MISMATCH,
        `Invalid task transition for task ${task.id}: expected current status ${from}, found ${task.status}.`,
      );
    }

    if (to === 'completed' && input.error) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_COMPLETED_WITH_ERROR,
        'Completed task transition cannot include an error payload.',
      );
    }

    const clearClaim = isTerminalTaskStatus(to);

    const persistedTask = await this.stateStore.writeTask(
      teamName,
      {
        id: task.id,
        subject: task.subject,
        status: to,
        claim: clearClaim ? undefined : task.claim,
        owner: clearClaim ? task.owner ?? worker : worker,
        result: input.result,
        error: input.error,
      },
      {
        expectedVersion: task.version,
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      },
    );

    await this.stateStore.appendTaskAuditEvent(teamName, {
      taskId: task.id,
      action: 'transition',
      worker,
      fromStatus: task.status,
      toStatus: to,
      reasonCode: reasonCodeForTransition(to),
      claimTokenDigest: createClaimTokenDigest(claimToken),
      metadata: {
        clearClaim,
        taskVersion: persistedTask.version,
      },
    });

    return persistedTask;
  }

  async releaseTaskClaim(input: ReleaseTaskClaimInput): Promise<PersistedTaskRecord> {
    const teamName = normalizeTeamName(input.teamName);
    const taskId = normalizeTaskIdentifier(input.taskId);
    const worker = normalizeWorkerName('worker', input.worker);
    const claimToken = normalizeRequiredString('claimToken', input.claimToken);
    const now = this.now();

    const task = await this.requireTask(teamName, taskId);
    this.assertClaim(task, worker, claimToken, now);

    const toStatus = input.toStatus ?? 'pending';

    const persistedTask = await this.stateStore.writeTask(
      teamName,
      {
        id: task.id,
        subject: task.subject,
        status: toStatus,
        claim: undefined,
        owner: toStatus === 'pending' ? undefined : worker,
      },
      {
        expectedVersion: task.version,
        lifecycleMutation: CONTROL_PLANE_TASK_LIFECYCLE_MUTATION_SCOPE,
      },
    );

    await this.stateStore.appendTaskAuditEvent(teamName, {
      taskId: task.id,
      action: 'release',
      worker,
      fromStatus: task.status,
      toStatus,
      reasonCode: reasonCodeForRelease(toStatus),
      claimTokenDigest: createClaimTokenDigest(claimToken),
      metadata: {
        taskVersion: persistedTask.version,
      },
    });

    return persistedTask;
  }

  private async requireTask(teamName: string, taskId: string): Promise<PersistedTaskRecord> {
    const task = await this.stateStore.readTask(teamName, taskId);
    if (!task) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_NOT_FOUND,
        `Task ${taskId} was not found for team ${teamName}.`,
      );
    }

    return task;
  }

  private async assertDependenciesCompleted(
    teamName: string,
    task: PersistedTaskRecord,
  ): Promise<void> {
    const dependencies = readTaskDependencies(task);

    if (dependencies.length === 0) {
      return;
    }

    const dependencyStates = await Promise.all(
      dependencies.map(async (dependencyTaskId) => {
        const dependencyTask = await this.stateStore.readTask(teamName, dependencyTaskId);
        if (!dependencyTask) {
          return `${dependencyTaskId}:missing`;
        }

        if (dependencyTask.status !== 'completed') {
          return `${dependencyTaskId}:${dependencyTask.status}`;
        }

        return null;
      }),
    );

    const unresolved = dependencyStates.filter(
      (dependency): dependency is string => dependency !== null,
    );

    if (unresolved.length > 0) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_DEPENDENCIES_UNRESOLVED,
        `Task ${task.id} has unresolved dependencies: ${unresolved.join(', ')}.`,
      );
    }
  }

  private assertClaim(
    task: PersistedTaskRecord,
    worker: string,
    claimToken: string,
    now: Date,
  ): void {
    if (!task.claim) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_MISSING,
        `Task ${task.id} does not have an active claim.`,
      );
    }

    if (task.claim.owner !== worker) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_OWNER_MISMATCH,
        `Task ${task.id} is claimed by ${task.claim.owner}; ${worker} cannot mutate it.`,
      );
    }

    if (task.claim.token !== claimToken) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_TOKEN_MISMATCH,
        `Task ${task.id} claim token mismatch.`,
      );
    }

    const leaseUntil = parseLeaseTimestamp(task.claim.leasedUntil);
    if (!Number.isFinite(leaseUntil) || leaseUntil <= now.getTime()) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.TASK_CLAIM_LEASE_EXPIRED,
        `Task ${task.id} claim lease expired at ${task.claim.leasedUntil}.`,
      );
    }
  }
}

export { DEFAULT_TASK_LEASE_MS };
