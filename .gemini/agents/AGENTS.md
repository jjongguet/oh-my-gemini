<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# agents

## Purpose
Defines the subagent role catalog used by the experimental `subagents` runtime backend.

## Key Files

| File | Description |
|------|-------------|
| `catalog.json` | Canonical catalog of role IDs, missions, and unified model assignment. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep `id` values stable and lowercase-normalized.
- Avoid duplicate IDs; selection resolution expects unique IDs.
- Use clear missions that map to concrete task responsibilities.

### Testing Requirements
- Validate JSON syntax.
- Run `npm run test:reliability` to exercise subagent catalog loading and validation behavior.

### Common Patterns
- Single unified model (`unifiedModel`) for all roles in the catalog.

## Dependencies

### Internal
- Parsed by `src/team/subagents-catalog.ts` and defaulted by `src/team/subagents-blueprint.ts`.

### External
- None directly; data consumed by local orchestration runtime.

<!-- MANUAL: -->
