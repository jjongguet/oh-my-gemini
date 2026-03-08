import {
  sendJsonWebhook,
  type WebhookDeliveryResult,
} from './webhook.js';
import { prependNotificationTags } from './tags.js';

const TELEGRAM_TOKEN_PATTERN = /^[0-9]+:[A-Za-z0-9_-]+$/;

export type TelegramParseMode = 'Markdown' | 'MarkdownV2' | 'HTML';

export interface TelegramBotOptions {
  botToken: string;
  chatId: string;
  message: string;
  parseMode?: TelegramParseMode;
  disableNotification?: boolean;
  disableWebPagePreview?: boolean;
  tagList?: string[];
  timeoutMs?: number;
}

interface TelegramSendMessageResponse {
  ok?: boolean;
  description?: string;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function validateTelegramBotToken(botToken: string): void {
  if (!botToken || typeof botToken !== 'string') {
    throw new Error('Telegram bot token is required');
  }

  if (!TELEGRAM_TOKEN_PATTERN.test(botToken)) {
    throw new Error('Telegram bot token format is invalid');
  }
}

export function validateTelegramChatId(chatId: string): void {
  if (!chatId || typeof chatId !== 'string') {
    throw new Error('Telegram chat ID is required');
  }

  if (!/^-?[0-9]+$/.test(chatId.trim())) {
    throw new Error('Telegram chat ID format is invalid');
  }
}

function parseTelegramResponseBody(rawBody: string | undefined): TelegramSendMessageResponse {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as TelegramSendMessageResponse;
  } catch {
    return {};
  }
}

export function composeTelegramMessage(message: string, tagList: string[] | undefined): string {
  return prependNotificationTags(message, tagList, 'telegram');
}

export async function sendTelegramBotMessage(
  options: TelegramBotOptions,
): Promise<WebhookDeliveryResult> {
  try {
    validateTelegramBotToken(options.botToken);
    validateTelegramChatId(options.chatId);
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }

  const payload: Record<string, unknown> = {
    chat_id: options.chatId,
    text: composeTelegramMessage(options.message, options.tagList),
  };

  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  if (options.disableNotification !== undefined) {
    payload.disable_notification = options.disableNotification;
  }

  if (options.disableWebPagePreview !== undefined) {
    payload.disable_web_page_preview = options.disableWebPagePreview;
  }

  const result = await sendJsonWebhook({
    url: `https://api.telegram.org/bot${options.botToken}/sendMessage`,
    payload,
    timeoutMs: options.timeoutMs,
  });

  if (!result.success) {
    return result;
  }

  const parsedBody = parseTelegramResponseBody(result.body);
  if (parsedBody.ok === false) {
    return {
      success: false,
      statusCode: result.statusCode,
      body: result.body,
      error: parsedBody.description ?? 'Telegram API reported failure',
    };
  }

  return result;
}
