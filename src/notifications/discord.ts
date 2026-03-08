import {
  sendJsonWebhook,
  type WebhookDeliveryResult,
  validateHttpsUrl,
} from './webhook.js';
import { prependNotificationTags } from './tags.js';

const DISCORD_MAX_CONTENT_LENGTH = 2000;

export interface DiscordWebhookOptions {
  webhookUrl: string;
  message: string;
  username?: string;
  avatarUrl?: string;
  mention?: string;
  tagList?: string[];
  timeoutMs?: number;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncateDiscordContent(content: string): string {
  if (content.length <= DISCORD_MAX_CONTENT_LENGTH) {
    return content;
  }

  return `${content.slice(0, DISCORD_MAX_CONTENT_LENGTH - 1)}…`;
}

export function composeDiscordContent(
  message: string,
  mention: string | undefined,
  tagList: string[] | undefined,
): string {
  const body = message.trim();
  const tags = prependNotificationTags('', tagList, 'discord').trim();
  return truncateDiscordContent([mention?.trim() || undefined, tags || undefined, body || undefined]
    .filter((value): value is string => Boolean(value))
    .join('\n'));
}

export function validateDiscordWebhookUrl(webhookUrl: string): URL {
  const parsed = validateHttpsUrl(webhookUrl, 'Discord webhook');

  const allowedHost =
    parsed.hostname === 'discord.com'
    || parsed.hostname === 'discordapp.com'
    || parsed.hostname.endsWith('.discord.com')
    || parsed.hostname.endsWith('.discordapp.com');

  if (!allowedHost) {
    throw new Error('Discord webhook: URL host must be discord.com or discordapp.com');
  }

  if (!parsed.pathname.includes('/api/webhooks/')) {
    throw new Error('Discord webhook: URL path must include /api/webhooks/');
  }

  return parsed;
}

export async function sendDiscordWebhook(
  options: DiscordWebhookOptions,
): Promise<WebhookDeliveryResult> {
  let validatedWebhookUrl: URL;
  try {
    validatedWebhookUrl = validateDiscordWebhookUrl(options.webhookUrl);
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }

  const payload: Record<string, unknown> = {
    content: composeDiscordContent(options.message, options.mention, options.tagList),
  };

  if (options.username) {
    payload.username = options.username;
  }

  if (options.avatarUrl) {
    payload.avatar_url = options.avatarUrl;
  }

  return sendJsonWebhook({
    url: validatedWebhookUrl.toString(),
    payload,
    timeoutMs: options.timeoutMs,
  });
}
