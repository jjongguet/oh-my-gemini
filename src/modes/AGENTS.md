<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# modes

## Purpose
Execution-mode implementations for Autopilot, Ralph, and Ultrawork plus shared team-run/verification helpers and mode contracts.

## Key Files

| File | Description |
|------|-------------|
| `autopilot.ts` | Autopilot state model and end-to-end execution flow. |
| `ralph.ts` | Ralph mode state and retry/verify loop. |
| `ultrawork.ts` | Ultrawork state and parallel worker execution flow. |
| `common.ts` | Shared helpers for team execution, naming, and verification. |
| `types.ts` | Mode execution request, dependency, and result contracts. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep per-mode files thin and put shared orchestration helpers in `common.ts`.
- Preserve mode-state persistence and verification semantics because hooks and session cleanup depend on them.

### Testing Requirements
- Run `npm run typecheck` and targeted mode/reliability tests when execution flow or state transitions change.

### Common Patterns
- Mode state read/write/clear helpers wrapped around a shared team-execution flow.

## Dependencies

### Internal
- Builds on hooks, `src/lib/mode-state-io`, and `src/team` orchestration.

### External
- Node crypto utilities for team-name fallbacks and IDs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
