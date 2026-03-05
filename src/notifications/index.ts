import {
  sendSlackWebhook,
  type SlackWebhookOptions,
  type WebhookDeliveryResult,
} from './webhook.js';
import {
  sendDiscordWebhook,
  type DiscordWebhookOptions,
} from './discord.js';
import {
  sendTelegramBotMessage,
  type TelegramBotOptions,
} from './telegram.js';

export type NotificationPlatform = 'slack' | 'discord' | 'telegram';

export interface SlackNotificationConfig extends SlackWebhookOptions {
  enabled: boolean;
}

export interface DiscordNotificationConfig extends DiscordWebhookOptions {
  enabled: boolean;
}

export interface TelegramNotificationConfig extends TelegramBotOptions {
  enabled: boolean;
}

export interface NotificationConfig {
  slack?: SlackNotificationConfig;
  discord?: DiscordNotificationConfig;
  telegram?: TelegramNotificationConfig;
}

export interface NotificationDispatchResult extends WebhookDeliveryResult {
  platform: NotificationPlatform;
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

export async function dispatchNotifications(
  config: NotificationConfig,
): Promise<NotificationDispatchResult[]> {
  const deliveries: Array<Promise<NotificationDispatchResult>> = [];

  if (config.slack?.enabled) {
    deliveries.push(
      sendSlackWebhook(config.slack).then((result) => withPlatform('slack', result)),
    );
  }

  if (config.discord?.enabled) {
    deliveries.push(
      sendDiscordWebhook(config.discord).then((result) => withPlatform('discord', result)),
    );
  }

  if (config.telegram?.enabled) {
    deliveries.push(
      sendTelegramBotMessage(config.telegram).then((result) => withPlatform('telegram', result)),
    );
  }

  if (deliveries.length === 0) {
    return [];
  }

  return Promise.all(deliveries);
}

export {
  sendSlackWebhook,
  sendDiscordWebhook,
  sendTelegramBotMessage,
};

export type {
  DiscordWebhookOptions,
  TelegramBotOptions,
  SlackWebhookOptions,
  WebhookDeliveryResult,
};

export {
  validateHttpsUrl,
  validateSlackWebhookUrl,
} from './webhook.js';
export { validateDiscordWebhookUrl } from './discord.js';
export {
  validateTelegramBotToken,
  validateTelegramChatId,
} from './telegram.js';
