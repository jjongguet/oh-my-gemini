import path from 'node:path';

import { readJsonFile, writeJsonFile } from '../state/filesystem.js';
import {
  sendSlackWebhook,
  sendGenericWebhook,
  composeSlackText,
  type GenericWebhookOptions,
  type SlackWebhookOptions,
  type WebhookDeliveryResult,
} from './webhook.js';
import {
  sendDiscordWebhook,
  composeDiscordContent,
  type DiscordWebhookOptions,
} from './discord.js';
import {
  sendTelegramBotMessage,
  composeTelegramMessage,
  type TelegramBotOptions,
} from './telegram.js';
import {
  buildSessionSummary,
  type SessionSummaryInput,
} from './summary.js';
import {
  formatNotificationTags,
  mergeNotificationTags,
  prependNotificationTags,
} from './tags.js';

export type NotificationPlatform = 'slack' | 'discord' | 'telegram' | 'webhook' | 'stop-callback';

export interface SlackNotificationConfig extends SlackWebhookOptions {
  enabled: boolean;
}

export interface DiscordNotificationConfig extends DiscordWebhookOptions {
  enabled: boolean;
}

export interface TelegramNotificationConfig extends TelegramBotOptions {
  enabled: boolean;
}

export interface WebhookNotificationConfig extends GenericWebhookOptions {
  enabled: boolean;
}

export interface StopCallbackEndpointConfig {
  enabled: boolean;
  url: string;
  tags?: string[];
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface NotificationConfig {
  slack?: SlackNotificationConfig;
  discord?: DiscordNotificationConfig;
  telegram?: TelegramNotificationConfig;
  webhook?: WebhookNotificationConfig;
  stopCallback?: StopCallbackEndpointConfig;
}

export interface NotificationDispatchResult extends WebhookDeliveryResult {
  platform: NotificationPlatform;
}

export interface StopCallbackSummaryInput extends SessionSummaryInput {
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface StopCallbackConfigFile {
  enabled: boolean;
  tagList?: string[];
  summaryFilePath?: string;
  notifications?: NotificationConfig;
}

function withPlatform(
  platform: NotificationPlatform,
  result: WebhookDeliveryResult,
): NotificationDispatchResult {
  return {
    platform,
    ...result,
  };
}

function resolveStopCallbackConfigPath(cwd: string): string {
  return path.join(cwd, '.omg', 'notifications', 'stop-callbacks.json');
}

export async function readStopCallbackConfig(cwd: string): Promise<StopCallbackConfigFile | null> {
  return readJsonFile<StopCallbackConfigFile>(resolveStopCallbackConfigPath(cwd));
}

export async function writeStopCallbackConfig(cwd: string, config: StopCallbackConfigFile): Promise<void> {
  await writeJsonFile(resolveStopCallbackConfigPath(cwd), config);
}

export async function saveSessionSummary(
  cwd: string,
  input: StopCallbackSummaryInput,
  explicitPath?: string,
): Promise<string> {
  const summary = buildSessionSummary(input);
  const relativePath = explicitPath ?? path.join('.omg', 'state', 'sessions', `${input.sessionId ?? 'session'}.summary.json`);
  const filePath = path.isAbsolute(relativePath) ? relativePath : path.join(cwd, relativePath);
  await writeJsonFile(filePath, {
    ...summary,
    metadata: {
      ...summary.metadata,
      tags: input.tags ?? [],
      extra: input.metadata ?? {},
    },
  });
  return filePath;
}

export async function dispatchNotifications(
  config: NotificationConfig,
): Promise<NotificationDispatchResult[]> {
  const deliveries: Array<Promise<NotificationDispatchResult>> = [];

  if (config.slack?.enabled) {
    deliveries.push(sendSlackWebhook(config.slack).then((result) => withPlatform('slack', result)));
  }

  if (config.discord?.enabled) {
    deliveries.push(sendDiscordWebhook(config.discord).then((result) => withPlatform('discord', result)));
  }

  if (config.telegram?.enabled) {
    deliveries.push(sendTelegramBotMessage(config.telegram).then((result) => withPlatform('telegram', result)));
  }

  if (config.webhook?.enabled) {
    deliveries.push(sendGenericWebhook(config.webhook).then((result) => withPlatform('webhook', result)));
  }

  return deliveries.length > 0 ? Promise.all(deliveries) : [];
}

export function buildGenericWebhookPayload(input: {
  url: string;
  event: string;
  message: string;
  tags?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    event: input.event,
    message: input.message,
    tags: input.tags ?? [],
    summary: input.summary,
    metadata: input.metadata ?? {},
    timestamp: new Date().toISOString(),
    targetUrl: input.url,
  };
}

export async function dispatchStopCallback(
  config: NotificationConfig,
  summaryInput: StopCallbackSummaryInput,
): Promise<NotificationDispatchResult[]> {
  const summary = buildSessionSummary(summaryInput);
  const mergedTags = mergeNotificationTags(summaryInput.tags, config.stopCallback?.tags);

  const deliveries = await dispatchNotifications({
    slack: config.slack?.enabled
      ? { ...config.slack, text: summary.text, tagList: mergedTags }
      : undefined,
    discord: config.discord?.enabled
      ? { ...config.discord, message: summary.text, tagList: mergedTags }
      : undefined,
    telegram: config.telegram?.enabled
      ? { ...config.telegram, message: summary.text, tagList: mergedTags }
      : undefined,
    webhook: config.webhook?.enabled
      ? {
          ...config.webhook,
          payload: buildGenericWebhookPayload({
            url: config.webhook.url,
            event: `session-${summaryInput.status}`,
            message: summary.text,
            tags: mergedTags,
            summary: summary.text,
            metadata: summaryInput.metadata,
          }),
        }
      : undefined,
  });

  if (config.stopCallback?.enabled) {
    const stopResult = await sendGenericWebhook({
      url: config.stopCallback.url,
      headers: config.stopCallback.headers,
      timeoutMs: config.stopCallback.timeoutMs,
      payload: buildGenericWebhookPayload({
        url: config.stopCallback.url,
        event: `session-${summaryInput.status}`,
        message: prependNotificationTags(summary.text, mergedTags, 'webhook'),
        tags: mergedTags,
        summary: summary.text,
        metadata: summaryInput.metadata,
      }),
    });
    deliveries.push(withPlatform('stop-callback', stopResult));
  }

  return deliveries;
}

export async function dispatchStopCallbacks(input: {
  cwd: string;
  config: StopCallbackConfigFile;
  summary: StopCallbackSummaryInput;
}): Promise<{ summaryPath: string | null; deliveries: NotificationDispatchResult[] }> {
  if (!input.config.enabled) {
    return { summaryPath: null, deliveries: [] };
  }

  const summaryPath = await saveSessionSummary(input.cwd, input.summary, input.config.summaryFilePath);
  const deliveries = await dispatchStopCallback(input.config.notifications ?? {}, {
    ...input.summary,
    tags: mergeNotificationTags(input.summary.tags, input.config.tagList),
  });
  return { summaryPath, deliveries };
}

export {
  buildSessionSummary,
  composeDiscordContent,
  composeSlackText,
  composeTelegramMessage,
  formatNotificationTags,
  mergeNotificationTags,
  prependNotificationTags as prefixMessageWithTags,
  sendDiscordWebhook,
  sendGenericWebhook,
  sendSlackWebhook,
  sendTelegramBotMessage,
};

export type {
  DiscordWebhookOptions,
  TelegramBotOptions,
  SlackWebhookOptions,
  GenericWebhookOptions,
  WebhookDeliveryResult,
  SessionSummaryInput,
};

export {
  isLoopbackHost,
  validateHttpsUrl,
  validateSlackWebhookUrl,
} from './webhook.js';
export { validateDiscordWebhookUrl } from './discord.js';
export {
  validateTelegramBotToken,
  validateTelegramChatId,
} from './telegram.js';
