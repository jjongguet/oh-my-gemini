<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# openclaw

## Purpose
OpenClaw gateway integration used to wake or notify external listeners about hook-related events without blocking core workflows.

## Key Files

| File | Description |
|------|-------------|
| `dispatcher.ts` | Dispatches HTTP or CLI gateway wake calls. |
| `config.ts` | Reads and caches OpenClaw config. |
| `types.ts` | Gateway and hook-event type contracts. |
| `index.ts` | Public OpenClaw exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep this integration fire-and-forget and failure tolerant so gateway issues do not block hook processing.

### Testing Requirements
- Run `npm run typecheck` and targeted OpenClaw tests when config parsing or dispatch behavior changes.

### Common Patterns
- Cached config reader plus gateway-type-based dispatch.

## Dependencies

### Internal
- Used by hook or runtime flows that emit out-of-band notifications.

### External
- Node filesystem, OS, and path utilities; external gateway endpoints or CLIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
