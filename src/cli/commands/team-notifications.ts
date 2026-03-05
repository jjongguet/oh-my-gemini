import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  dispatchNotifications,
  type NotificationConfig,
  type NotificationDispatchResult,
} from '../../notifications/index.js';

export type TeamLifecycleNotificationEvent =
  | 'team-run-started'
  | 'team-run-completed'
  | 'team-run-failed';

export interface TeamLifecycleNotificationPayload {
  teamName: string;
  backend: string;
  workers: number;
  task: string;
  phase?: string;
  attempts?: number;
  error?: string;
}

export interface TeamLifecycleNotificationConfig {
  slack?: Omit<NonNullable<NotificationConfig['slack']>, 'text'>;
  discord?: Omit<NonNullable<NotificationConfig['discord']>, 'message'>;
  telegram?: Omit<NonNullable<NotificationConfig['telegram']>, 'message'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnabledChannel<T extends Record<string, unknown>>(
  raw: unknown,
): T | undefined {
  if (!isRecord(raw) || raw.enabled !== true) {
    return undefined;
  }

  return raw as T;
}

function coerceConfig(raw: unknown): TeamLifecycleNotificationConfig | null {
  if (!isRecord(raw)) {
    return null;
  }

  const slackRaw = readEnabledChannel<Record<string, unknown>>(raw.slack);
  const discordRaw = readEnabledChannel<Record<string, unknown>>(raw.discord);
  const telegramRaw = readEnabledChannel<Record<string, unknown>>(raw.telegram);

  const slackWebhookUrl = readNonEmptyString(slackRaw?.webhookUrl);
  const discordWebhookUrl = readNonEmptyString(discordRaw?.webhookUrl);
  const telegramBotToken = readNonEmptyString(telegramRaw?.botToken);
  const telegramChatId = readNonEmptyString(telegramRaw?.chatId);

  const config: TeamLifecycleNotificationConfig = {};

  if (slackRaw && slackWebhookUrl) {
    config.slack = {
      enabled: true,
      webhookUrl: slackWebhookUrl,
      ...(readNonEmptyString(slackRaw.username)
        ? { username: readNonEmptyString(slackRaw.username) }
        : {}),
      ...(readNonEmptyString(slackRaw.channel)
        ? { channel: readNonEmptyString(slackRaw.channel) }
        : {}),
      ...(readNonEmptyString(slackRaw.iconEmoji)
        ? { iconEmoji: readNonEmptyString(slackRaw.iconEmoji) }
        : {}),
      ...(readNonEmptyString(slackRaw.mention)
        ? { mention: readNonEmptyString(slackRaw.mention) }
        : {}),
    };
  }

  if (discordRaw && discordWebhookUrl) {
    config.discord = {
      enabled: true,
      webhookUrl: discordWebhookUrl,
      ...(readNonEmptyString(discordRaw.username)
        ? { username: readNonEmptyString(discordRaw.username) }
        : {}),
      ...(readNonEmptyString(discordRaw.avatarUrl)
        ? { avatarUrl: readNonEmptyString(discordRaw.avatarUrl) }
        : {}),
      ...(readNonEmptyString(discordRaw.mention)
        ? { mention: readNonEmptyString(discordRaw.mention) }
        : {}),
    };
  }

  if (telegramRaw && telegramBotToken && telegramChatId) {
    config.telegram = {
      enabled: true,
      botToken: telegramBotToken,
      chatId: telegramChatId,
      ...(readNonEmptyString(telegramRaw.parseMode)
        ? {
            parseMode: readNonEmptyString(telegramRaw.parseMode) as
              | 'Markdown'
              | 'MarkdownV2'
              | 'HTML',
          }
        : {}),
    };
  }

  return config.slack || config.discord || config.telegram ? config : null;
}

function coerceConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TeamLifecycleNotificationConfig | null {
  const slackWebhookUrl =
    readNonEmptyString(env.OMG_SLACK_WEBHOOK_URL) ??
    readNonEmptyString(env.OMX_SLACK_WEBHOOK_URL);
  const discordWebhookUrl =
    readNonEmptyString(env.OMG_DISCORD_WEBHOOK_URL) ??
    readNonEmptyString(env.OMX_DISCORD_WEBHOOK_URL);
  const telegramBotToken =
    readNonEmptyString(env.OMG_TELEGRAM_BOT_TOKEN) ??
    readNonEmptyString(env.OMX_TELEGRAM_BOT_TOKEN);
  const telegramChatId =
    readNonEmptyString(env.OMG_TELEGRAM_CHAT_ID) ??
    readNonEmptyString(env.OMX_TELEGRAM_CHAT_ID);

  const config: TeamLifecycleNotificationConfig = {};

  if (slackWebhookUrl) {
    config.slack = {
      enabled: true,
      webhookUrl: slackWebhookUrl,
      ...(readNonEmptyString(env.OMG_SLACK_MENTION)
        ? { mention: readNonEmptyString(env.OMG_SLACK_MENTION) }
        : {}),
    };
  }

  if (discordWebhookUrl) {
    config.discord = {
      enabled: true,
      webhookUrl: discordWebhookUrl,
      ...(readNonEmptyString(env.OMG_DISCORD_MENTION)
        ? { mention: readNonEmptyString(env.OMG_DISCORD_MENTION) }
        : {}),
    };
  }

  if (telegramBotToken && telegramChatId) {
    config.telegram = {
      enabled: true,
      botToken: telegramBotToken,
      chatId: telegramChatId,
    };
  }

  return config.slack || config.discord || config.telegram ? config : null;
}

export async function loadTeamLifecycleNotificationConfig(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TeamLifecycleNotificationConfig | null> {
  const configPath = path.join(cwd, '.omg', 'notifications.json');

  try {
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const fromFile = coerceConfig(parsed);
    if (fromFile) {
      return fromFile;
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      return null;
    }
  }

  return coerceConfigFromEnv(env);
}

function buildMessage(
  event: TeamLifecycleNotificationEvent,
  payload: TeamLifecycleNotificationPayload,
): string {
  switch (event) {
    case 'team-run-started':
      return `[omg team] started team=${payload.teamName} backend=${payload.backend} workers=${payload.workers} task="${payload.task}"`;
    case 'team-run-completed':
      return `[omg team] completed team=${payload.teamName} phase=${payload.phase ?? 'unknown'} attempts=${payload.attempts ?? 0}`;
    case 'team-run-failed':
      return `[omg team] failed team=${payload.teamName} phase=${payload.phase ?? 'unknown'} error="${payload.error ?? 'unknown error'}"`;
    default:
      return `[omg team] event=${event} team=${payload.teamName}`;
  }
}

function toDispatchConfig(
  config: TeamLifecycleNotificationConfig,
  message: string,
): NotificationConfig {
  return {
    ...(config.slack
      ? {
          slack: {
            ...config.slack,
            text: message,
          },
        }
      : {}),
    ...(config.discord
      ? {
          discord: {
            ...config.discord,
            message,
          },
        }
      : {}),
    ...(config.telegram
      ? {
          telegram: {
            ...config.telegram,
            message,
          },
        }
      : {}),
  };
}

export async function dispatchTeamLifecycleNotification(
  config: TeamLifecycleNotificationConfig | null,
  event: TeamLifecycleNotificationEvent,
  payload: TeamLifecycleNotificationPayload,
  dispatcher: (
    config: NotificationConfig,
  ) => Promise<NotificationDispatchResult[]> = dispatchNotifications,
): Promise<NotificationDispatchResult[]> {
  if (!config) {
    return [];
  }

  const message = buildMessage(event, payload);
  const dispatchConfig = toDispatchConfig(config, message);
  return dispatcher(dispatchConfig);
}

