import {
  TeamStateStore,
  type PersistedMailboxMessage,
} from '../../state/index.js';
import {
  normalizeMessageIdentifier,
  normalizeTeamName,
  normalizeWorkerName,
} from './identifiers.js';
import {
  CONTROL_PLANE_FAILURE_CODES,
  createControlPlaneFailure,
} from './failure-taxonomy.js';

export interface MailboxControlPlaneOptions {
  stateStore?: TeamStateStore;
  now?: () => Date;
}

export interface SendMailboxMessageInput {
  teamName: string;
  fromWorker: string;
  toWorker: string;
  body: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

export interface ListMailboxMessagesInput {
  teamName: string;
  worker: string;
  includeDelivered?: boolean;
}

export interface MarkMailboxMessageInput {
  teamName: string;
  worker: string;
  messageId: string;
  at?: string;
}

function normalizeIsoTimestamp(raw: string | undefined, fallback: string): string {
  if (!raw) {
    return fallback;
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.INVALID_TIMESTAMP,
      `Invalid ISO timestamp: ${raw}`,
    );
  }

  return new Date(parsed).toISOString();
}

function mergeMailboxMessages(
  previous: PersistedMailboxMessage,
  current: PersistedMailboxMessage,
): PersistedMailboxMessage {
  return {
    ...previous,
    ...current,
    messageId: previous.messageId,
    fromWorker: current.fromWorker || previous.fromWorker,
    toWorker: current.toWorker || previous.toWorker,
    body: current.body || previous.body,
    createdAt: previous.createdAt,
    deliveredAt: current.deliveredAt ?? previous.deliveredAt,
    notifiedAt: current.notifiedAt ?? previous.notifiedAt,
    metadata: current.metadata ?? previous.metadata,
    message_id: current.message_id ?? previous.message_id,
    from_worker: current.from_worker ?? previous.from_worker,
    to_worker: current.to_worker ?? previous.to_worker,
    created_at: current.created_at ?? previous.created_at,
    delivered_at: current.delivered_at ?? previous.delivered_at,
    notified_at: current.notified_at ?? previous.notified_at,
  };
}

function collapseMailboxTimeline(
  timeline: PersistedMailboxMessage[],
): PersistedMailboxMessage[] {
  const collapsed = new Map<string, PersistedMailboxMessage>();

  for (const entry of timeline) {
    if (!entry.messageId) {
      continue;
    }

    const existing = collapsed.get(entry.messageId);
    if (!existing) {
      collapsed.set(entry.messageId, entry);
      continue;
    }

    collapsed.set(entry.messageId, mergeMailboxMessages(existing, entry));
  }

  return [...collapsed.values()];
}

export class MailboxControlPlane {
  private readonly stateStore: TeamStateStore;
  private readonly now: () => Date;

  constructor(options: MailboxControlPlaneOptions = {}) {
    this.stateStore = options.stateStore ?? new TeamStateStore();
    this.now = options.now ?? (() => new Date());
  }

  async sendMessage(input: SendMailboxMessageInput): Promise<PersistedMailboxMessage> {
    const teamName = normalizeTeamName(input.teamName);
    const fromWorker = normalizeWorkerName('fromWorker', input.fromWorker);
    const toWorker = normalizeWorkerName('toWorker', input.toWorker);

    if (!input.body || !input.body.trim()) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.MAILBOX_BODY_EMPTY,
        'Mailbox message body cannot be empty.',
      );
    }

    return this.stateStore.appendMailboxMessage(teamName, toWorker, {
      messageId: input.messageId,
      fromWorker,
      toWorker,
      body: input.body,
      metadata: input.metadata,
    });
  }

  async listMessages(
    input: ListMailboxMessagesInput,
  ): Promise<PersistedMailboxMessage[]> {
    const teamName = normalizeTeamName(input.teamName);
    const worker = normalizeWorkerName('worker', input.worker);

    const timeline = await this.stateStore.readMailboxMessages(teamName, worker);
    const collapsed = collapseMailboxTimeline(timeline);

    if (input.includeDelivered === false) {
      return collapsed.filter((message) => !message.deliveredAt);
    }

    return collapsed;
  }

  async markMessageDelivered(
    input: MarkMailboxMessageInput,
  ): Promise<PersistedMailboxMessage> {
    const timestamp = normalizeIsoTimestamp(input.at, this.now().toISOString());
    return this.markMessageLifecycle(input, {
      deliveredAt: timestamp,
    });
  }

  async markMessageNotified(
    input: MarkMailboxMessageInput,
  ): Promise<PersistedMailboxMessage> {
    const timestamp = normalizeIsoTimestamp(input.at, this.now().toISOString());
    return this.markMessageLifecycle(input, {
      notifiedAt: timestamp,
    });
  }

  private async markMessageLifecycle(
    input: MarkMailboxMessageInput,
    patch: {
      deliveredAt?: string;
      notifiedAt?: string;
    },
  ): Promise<PersistedMailboxMessage> {
    const teamName = normalizeTeamName(input.teamName);
    const worker = normalizeWorkerName('worker', input.worker);
    const messageId = normalizeMessageIdentifier(input.messageId);

    const messages = await this.listMessages({
      teamName,
      worker,
      includeDelivered: true,
    });
    const target = messages.find((message) => message.messageId === messageId);

    if (!target) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.MAILBOX_MESSAGE_NOT_FOUND,
        `Mailbox message ${messageId} was not found for ${teamName}/${worker}.`,
      );
    }

    if (patch.deliveredAt && target.deliveredAt) {
      return target;
    }

    if (patch.notifiedAt && target.notifiedAt) {
      return target;
    }

    await this.stateStore.appendMailboxMessage(teamName, worker, {
      messageId: target.messageId,
      fromWorker: target.fromWorker,
      toWorker: target.toWorker,
      body: target.body,
      createdAt: target.createdAt,
      deliveredAt: patch.deliveredAt ?? target.deliveredAt,
      notifiedAt: patch.notifiedAt ?? target.notifiedAt,
      metadata: target.metadata,
    });

    const updatedMessages = await this.listMessages({
      teamName,
      worker,
      includeDelivered: true,
    });

    const updated = updatedMessages.find(
      (message) => message.messageId === target.messageId,
    );

    if (!updated) {
      throw createControlPlaneFailure(
        CONTROL_PLANE_FAILURE_CODES.MAILBOX_RELOAD_FAILED,
        `Failed to reload mailbox message ${target.messageId} after lifecycle update.`,
      );
    }

    return updated;
  }
}

export { collapseMailboxTimeline };
