<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:32:43Z | Updated: 2026-02-25T05:32:43Z -->

# state

## Purpose
Stores persisted runtime state for `omg team run` lifecycle execution.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `team/` | Per-team execution state (`phase.json`, monitor snapshot, transitions). See `team/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- This directory is runtime-generated and may be deleted/rebuilt between runs.
- For persistent behavior fixes, update state-store/orchestrator code rather than patching artifacts.

### Testing Requirements
- Use integration/reliability tests to validate intended state side-effects.

### Common Patterns
- Team namespace partitioning under `team/<team-name>/`.

## Dependencies

### Internal
- Written by `TeamStateStore` and `TeamOrchestrator`.

### External
- None.

<!-- MANUAL: -->
