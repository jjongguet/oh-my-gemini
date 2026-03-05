import { describe, expect, test } from 'vitest';

import {
  dispatchNotifications,
  sendDiscordWebhook,
  sendSlackWebhook,
  sendTelegramBotMessage,
  validateDiscordWebhookUrl,
  validateSlackWebhookUrl,
  validateTelegramBotToken,
  validateTelegramChatId,
} from '../../src/notifications/index.js';

describe('integration: notifications module contracts', () => {
  test('returns empty dispatch result when no platform is enabled', async () => {
    const results = await dispatchNotifications({});
    expect(results).toStrictEqual([]);
  });

  test('validates Slack and Discord webhook URL host restrictions', () => {
    expect(() => {
      validateSlackWebhookUrl('https://hooks.slack.com/services/T00/B00/XXX');
    }).not.toThrow();

    expect(() => {
      validateSlackWebhookUrl('https://example.com/slack');
    }).toThrow(/hooks\.slack\.com/i);

    expect(() => {
      validateDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc');
    }).not.toThrow();

    expect(() => {
      validateDiscordWebhookUrl('https://example.com/api/webhooks/123/abc');
    }).toThrow(/discord\.com/i);
  });

  test('validates Telegram bot token and chat id formats', () => {
    expect(() => {
      validateTelegramBotToken('123456:abcdef_ABCDEF-12345');
      validateTelegramChatId('-1001234567890');
    }).not.toThrow();

    expect(() => {
      validateTelegramBotToken('bad-token');
    }).toThrow(/format is invalid/i);

    expect(() => {
      validateTelegramChatId('chat-room');
    }).toThrow(/format is invalid/i);
  });

  test('fails fast for invalid platform configuration without network calls', async () => {
    const slack = await sendSlackWebhook({
      webhookUrl: 'https://example.com/slack',
      text: 'hello',
    });
    expect(slack.success).toBe(false);
    expect(slack.error).toMatch(/hooks\.slack\.com/i);

    const discord = await sendDiscordWebhook({
      webhookUrl: 'https://example.com/api/webhooks/123/abc',
      message: 'hello',
    });
    expect(discord.success).toBe(false);
    expect(discord.error).toMatch(/discord\.com/i);

    const telegram = await sendTelegramBotMessage({
      botToken: 'invalid',
      chatId: 'room',
      message: 'hello',
    });
    expect(telegram.success).toBe(false);
    expect(telegram.error).toMatch(/format is invalid/i);
  });
});
