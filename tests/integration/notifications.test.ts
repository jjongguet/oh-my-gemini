import { describe, expect, test } from 'vitest';

import {
  buildGenericWebhookPayload,
  buildSessionSummary,
  composeDiscordContent,
  composeSlackText,
  composeTelegramMessage,
  dispatchNotifications,
  dispatchStopCallback,
  formatNotificationTags,
  mergeNotificationTags,
  sendDiscordWebhook,
  sendGenericWebhook,
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

  test('formats tags for slack, discord, and telegram payloads', () => {
    expect(composeSlackText('hello', '<!here>', ['release', '@ops'])).toBe('<!here>\nrelease @ops\nhello');
    expect(composeDiscordContent('hello', '<@123>', ['release', '@ops'])).toBe('<@123>\nrelease @ops\nhello');
    expect(composeTelegramMessage('hello', ['release candidate', '@ops'])).toBe('#release_candidate @ops\nhello');
    expect(formatNotificationTags([' release ', 'release', 'ops'], 'slack')).toBe('release ops');
    expect(mergeNotificationTags(['release'], ['ops', 'release'])).toStrictEqual(['release', 'ops']);
  });

  test('builds session summaries for completion callbacks', () => {
    const summary = buildSessionSummary({
      sessionId: 'sess-123',
      status: 'completed',
      projectName: 'oh-my-product',
      durationMs: 95_000,
      tasksCompleted: 4,
      tasksFailed: 1,
      workersCompleted: 2,
      workersTotal: 3,
      reason: 'all critical work finished',
      notes: ['follow-up docs remain'],
    });

    expect(summary.title).toBe('oh-my-product completed');
    expect(summary.text).toContain('session=sess-123');
    expect(summary.text).toContain('duration=1m 35s');
    expect(summary.text).toContain('tasks=4 completed, 1 failed');
    expect(summary.text).toContain('workers=2/3');
    expect(summary.text).toContain('reason=all critical work finished');
    expect(summary.text).toContain('note=follow-up docs remain');
  });

  test('builds generic webhook payloads for callback delivery', () => {
    const payload = buildGenericWebhookPayload({
      url: 'https://example.com/callback',
      event: 'session-completed',
      message: 'done',
      tags: ['release'],
      summary: 'summary text',
      metadata: { branch: 'main' },
    });

    expect(payload.event).toBe('session-completed');
    expect(payload.message).toBe('done');
    expect(payload.tags).toStrictEqual(['release']);
    expect(payload.summary).toBe('summary text');
    expect(payload.metadata).toStrictEqual({ branch: 'main' });
    expect(typeof payload.timestamp).toBe('string');
  });

  test('generic webhook and stop callback fail fast for invalid URLs without network calls', async () => {
    const webhook = await sendGenericWebhook({
      url: 'http://example.com/insecure',
      message: 'done',
    });
    expect(webhook.success).toBe(false);
    expect(webhook.error).toMatch(/HTTPS/i);

    const stopResults = await dispatchStopCallback(
      {
        stopCallback: {
          enabled: true,
          url: 'http://example.com/insecure',
        },
      },
      {
        sessionId: 'sess-stop',
        status: 'completed',
        projectName: 'oh-my-product',
      },
    );

    expect(stopResults).toHaveLength(1);
    expect(stopResults[0]?.platform).toBe('stop-callback');
    expect(stopResults[0]?.success).toBe(false);
    expect(stopResults[0]?.error).toMatch(/HTTPS/i);
  });

  test('dispatchStopCallback fans out summary-aware notifications and stop callbacks', async () => {
    const results = await dispatchStopCallback(
      {
        slack: {
          enabled: true,
          webhookUrl: 'https://example.com/slack',
          text: 'unused',
        },
        webhook: {
          enabled: true,
          url: 'https://example.com/generic',
        },
        stopCallback: {
          enabled: true,
          url: 'https://example.com/stop',
          tags: ['release'],
        },
      },
      {
        sessionId: 'sess-456',
        status: 'failed',
        projectName: 'oh-my-product',
        reason: 'validation failure',
        tags: ['urgent'],
      },
    );

    expect(results.map((result) => result.platform)).toStrictEqual(['slack', 'webhook', 'stop-callback']);
    expect(results.every((result) => result.success === false)).toBe(true);
  });
});
