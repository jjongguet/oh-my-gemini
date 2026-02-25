<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# state

## Purpose
Provides filesystem-level persistence utilities and a typed state store for team phase, monitor snapshot, and worker heartbeat/status data.

## Key Files

| File | Description |
|------|-------------|
| `filesystem.ts` | Directory creation, JSON read/write, and NDJSON append helpers. |
| `team-state-store.ts` | Structured read/write APIs for `.omg/state/team/<team>/...` artifacts. |
| `types.ts` | Persisted state type contracts (phases, snapshots, worker signals). |
| `index.ts` | Barrel exports for state helpers and types. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep persisted file schema stable and backwards-compatible when possible.
- Preserve atomic-ish writes (`temp + rename`) for JSON updates.

### Testing Requirements
- Run reliability/integration tests that consume persisted state:
  - `npm run test:integration`
  - `npm run test:reliability`

### Common Patterns
- Team-scoped directory layout with explicit helper methods for each artifact path.

## Dependencies

### Internal
- Used heavily by `src/team/team-orchestrator.ts` and related tests.

### External
- Node filesystem/path modules.

<!-- MANUAL: -->
