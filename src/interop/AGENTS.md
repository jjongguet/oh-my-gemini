<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# interop

## Purpose
Protocol adapters and format-conversion helpers that bridge OMG task/state data to external or cross-subsystem representations.

## Key Files

| File | Description |
|------|-------------|
| `api-bridges.ts` | Bridge logic for requests, tasks, and message payloads. |
| `format-converters.ts` | Conversion helpers for tasks, status, and message formats. |
| `protocol-adapters.ts` | Shared-memory and file-based protocol adapters. |
| `index.ts` | Public interop exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep conversions explicit and document any lossy mapping rather than hiding it in helper code.
- Prefer adapting at the boundary here instead of leaking external representations deeper into the codebase.

### Testing Requirements
- Run `npm run typecheck` and targeted interop/reliability tests for changed converters or adapters.

### Common Patterns
- Typed conversion helpers plus protocol-specific adapters.

## Dependencies

### Internal
- Touches `src/mcp`, `src/state`, and `src/team/control-plane`.

### External
- Node crypto/filesystem/path utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
