<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# notifications

## Purpose
Notification delivery adapters for generic webhooks, Discord, and Telegram plus session-summary formatting helpers.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Notification config parsing, dispatch routing, and high-level helpers. |
| `webhook.ts` | Generic webhook delivery implementation. |
| `discord.ts` | Discord formatting and validation helpers. |
| `telegram.ts` | Telegram formatting and validation helpers. |
| `summary.ts` | Notification title/body summary formatting. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep platform-specific validation and formatting in the platform file rather than centralizing everything in `index.ts`.
- Avoid exposing secrets in logs or error messages.

### Testing Requirements
- Run `npm run typecheck` and targeted notification tests when payload formatting or delivery behavior changes.

### Common Patterns
- Validate config -> format payload -> send via HTTP(S) -> normalize result.

## Dependencies

### Internal
- Uses state/filesystem helpers and is referenced by command/workflow surfaces that emit notifications.

### External
- Webhook-based delivery endpoints and Node HTTP(S) APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
