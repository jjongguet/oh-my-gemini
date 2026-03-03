<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-03T07:46:00Z | Updated: 2026-03-03T07:46:00Z -->

# common

## Purpose
Shared utility modules used across CLI, team orchestration, and state layers. Contains cross-cutting helpers that do not belong to any single subsystem.

## Key Files

| File | Description |
|------|-------------|
| `team-name.ts` | Team name generation and validation utilities. Produces deterministic, filesystem-safe identifiers for team state directories. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep utilities pure and dependency-free (no imports from `cli/`, `team/`, or `state/`).
- Functions here may be imported by any other module in `src/`.

### Testing Requirements
- Unit tests belong in `tests/reliability/` or `tests/smoke/` as appropriate.
- No side effects — pure functions only.

### Common Patterns
- Exported functions are named exports (no default exports).
- Keep logic minimal and focused on a single concern per file.

## Dependencies

### Internal
- None (this module is a leaf dependency).

### External
- Node.js core modules only.

<!-- MANUAL: -->
