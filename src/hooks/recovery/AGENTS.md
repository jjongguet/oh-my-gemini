<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# recovery

## Purpose
Recovery classification and retry helpers for recoverable runtime/tool failures.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Implementation for the `recovery` hook module. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep activation or lifecycle behavior aligned with the shared hook contracts in `src/hooks/types.ts`.
- Prefer reusing shared routing, state, or recovery helpers instead of duplicating logic here.

### Testing Requirements
- Run `npm run typecheck` and targeted hook tests when this module changes.

### Common Patterns
- Focused single-module hook directory with `index.ts` as the public implementation entrypoint.

## Dependencies

### Internal
- Consumed by mode execution and the top-level recovery hook wrapper.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
