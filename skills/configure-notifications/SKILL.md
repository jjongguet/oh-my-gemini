---
name: configure-notifications
aliases: ["/configure-notifications", "notifications", "notify setup"]
primaryRole: writer
description: Configure notification delivery for Slack, Discord, or Telegram.
---

# Configure Notifications (oh-my-product)

Use this skill when a user wants to configure or verify notifications.

## Platforms
- Slack webhook
- Discord webhook
- Telegram bot message

## Canonical implementation
- `src/notifications/webhook.ts`
- `src/notifications/discord.ts`
- `src/notifications/telegram.ts`
- `src/notifications/index.ts`

## Verification
After configuration, send a safe test notification and confirm the platform-specific validator passes.
