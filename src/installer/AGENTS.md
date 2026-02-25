<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# installer

## Purpose
Implements idempotent setup behavior: scope resolution/persistence, managed marker block merging, and provisioning of Gemini baseline files.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Main `runSetup` flow, action status reporting, and managed file provisioning. |
| `scopes.ts` | Setup scope typing, precedence resolution, and persistence helpers. |
| `merge-markers.ts` | Marker block merge primitives for non-destructive managed-content updates. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Preserve idempotency: repeated setup runs must avoid unintended drift.
- Keep action status semantics (`created/updated/unchanged/skipped`) stable.
- Never overwrite user content outside managed marker regions.

### Testing Requirements
- Run smoke + setup idempotency checks:
  - `bash scripts/smoke-install.sh`
  - `npm run test:smoke`

### Common Patterns
- Read current file state, compute normalized desired state, write only when changed.

## Dependencies

### Internal
- Consumed by `src/cli/commands/setup.ts`; uses `src/team/subagents-blueprint.ts` for default catalog payload.

### External
- Node filesystem/path APIs.

<!-- MANUAL: -->
