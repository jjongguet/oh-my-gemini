---
name: configure-notifications
aliases: ["/configure-notifications", "notifications", "notify setup"]
primaryRole: writer
description: "Configure and verify notification delivery via Slack webhooks, Discord webhooks, or Telegram bot messages. Use when the user wants to set up alerts, connect a webhook, enable notifications, or test message delivery to a chat platform."
---

# Configure Notifications (oh-my-gemini)

Use this skill when a user wants to set up, update, or verify notification delivery for orchestration events.

## Supported platforms

| Platform | Method | Credential needed |
|----------|--------|-------------------|
| Slack | Incoming webhook | Webhook URL |
| Discord | Webhook | Webhook URL |
| Telegram | Bot API | Bot token + chat ID |

## Workflow

1. **Choose platform** — confirm which platform the user wants.
2. **Collect credentials** — ask for the webhook URL or bot token.
3. **Configure** — update the notification config in the project.
4. **Test** — send a test notification and verify delivery.
5. **Confirm** — show the user the success or failure result.

## Configuration example (Slack)

```bash
# Set the Slack webhook URL
omg configure --notifications.slack.webhook "https://hooks.slack.com/services/T00/B00/xxx"

# Send a test notification
omg notify test --platform slack
```

Expected success output:
```
✔ Slack notification delivered to #my-channel
  Message: "oh-my-gemini test notification"
  Status: 200 OK
```

Expected failure output:
```
✗ Slack notification failed
  Error: 404 — webhook URL is invalid or channel was deleted
  Fix: verify the webhook URL at https://api.slack.com/apps
```

## Canonical implementation

- `src/notifications/webhook.ts` — shared webhook delivery logic
- `src/notifications/discord.ts` — Discord-specific formatting
- `src/notifications/telegram.ts` — Telegram Bot API integration
- `src/notifications/index.ts` — platform router and config loading

## Troubleshooting

- **Webhook returns 403**: check that the webhook is not restricted to specific IPs or channels.
- **Telegram bot not responding**: verify the bot token with `https://api.telegram.org/bot<token>/getMe`.
- **No notification received**: confirm the channel/chat exists and the bot has post permissions.

Task: {{ARGUMENTS}}
