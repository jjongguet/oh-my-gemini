import { TeamStateStore, type PersistedMailboxMessage, type PersistedTaskRecord } from '../../state/index.js';

import {
  MailboxControlPlane,
  type ListMailboxMessagesInput,
  type MailboxControlPlaneOptions,
  type MarkMailboxMessageInput,
  type SendMailboxMessageInput,
} from './mailbox-lifecycle.js';
import {
  TaskControlPlane,
  type CancelTaskInput,
  type ClaimTaskInput,
  type ClaimTaskResult,
  type ReleaseTaskClaimInput,
  type ReapExpiredTaskClaimsInput,
  type ReapExpiredTaskClaimsResult,
  type TaskControlPlaneOptions,
  type TransitionTaskInput,
} from './task-lifecycle.js';

export interface TeamControlPlaneOptions
  extends TaskControlPlaneOptions,
    Omit<MailboxControlPlaneOptions, 'stateStore'> {
  stateStore?: TeamStateStore;
  rootDir?: string;
  cwd?: string;
}

export class TeamControlPlane {
  readonly stateStore: TeamStateStore;
  readonly tasks: TaskControlPlane;
  readonly mailbox: MailboxControlPlane;

  constructor(options: TeamControlPlaneOptions = {}) {
    const stateStore =
      options.stateStore ??
      new TeamStateStore({
        rootDir: options.rootDir,
        cwd: options.cwd,
      });

    this.stateStore = stateStore;
    this.tasks = new TaskControlPlane({
      stateStore,
      defaultLeaseMs: options.defaultLeaseMs,
      now: options.now,
    });
    this.mailbox = new MailboxControlPlane({
      stateStore,
      now: options.now,
    });
  }

  claimTask(input: ClaimTaskInput): Promise<ClaimTaskResult> {
    return this.tasks.claimTask(input);
  }

  cancelTask(input: CancelTaskInput): Promise<PersistedTaskRecord> {
    return this.tasks.cancelTask(input);
  }

  transitionTaskStatus(input: TransitionTaskInput): Promise<PersistedTaskRecord> {
    return this.tasks.transitionTaskStatus(input);
  }

  releaseTaskClaim(input: ReleaseTaskClaimInput): Promise<PersistedTaskRecord> {
    return this.tasks.releaseTaskClaim(input);
  }

  reapExpiredTaskClaims(
    input: ReapExpiredTaskClaimsInput,
  ): Promise<ReapExpiredTaskClaimsResult> {
    return this.tasks.reapExpiredTaskClaims(input);
  }

  sendMailboxMessage(input: SendMailboxMessageInput): Promise<PersistedMailboxMessage> {
    return this.mailbox.sendMessage(input);
  }

  listMailboxMessages(input: ListMailboxMessagesInput): Promise<PersistedMailboxMessage[]> {
    return this.mailbox.listMessages(input);
  }

  markMailboxMessageDelivered(
    input: MarkMailboxMessageInput,
  ): Promise<PersistedMailboxMessage> {
    return this.mailbox.markMessageDelivered(input);
  }

  markMailboxMessageNotified(
    input: MarkMailboxMessageInput,
  ): Promise<PersistedMailboxMessage> {
    return this.mailbox.markMessageNotified(input);
  }
}

export {
  MailboxControlPlane,
  collapseMailboxTimeline,
  type ListMailboxMessagesInput,
  type MailboxControlPlaneOptions,
  type MarkMailboxMessageInput,
  type SendMailboxMessageInput,
} from './mailbox-lifecycle.js';

export {
  TaskControlPlane,
  DEFAULT_TASK_LEASE_MS,
  type CancelTaskInput,
  type ClaimTaskInput,
  type ClaimTaskResult,
  type ReleaseTaskClaimInput,
  type ReapExpiredTaskClaimsInput,
  type ReapExpiredTaskClaimsResult,
  type TaskControlPlaneOptions,
  type TransitionTaskInput,
} from './task-lifecycle.js';
