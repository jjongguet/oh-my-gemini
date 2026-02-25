<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:32:43Z | Updated: 2026-02-25T05:32:43Z -->

# team

## Purpose
Holds per-team lifecycle records for `oh-my-gemini` orchestration runs.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `oh-my-gemini/` | Default team namespace snapshots and phase history. See `oh-my-gemini/AGENTS.md`. |
| `phase-c-worker3-smoke/` | Reliability/smoke run artifacts for a named scenario. See `phase-c-worker3-smoke/AGENTS.md`. |
| `task4-subagents-smoke/` | Subagents smoke run artifacts. See `task4-subagents-smoke/AGENTS.md`. |
| `worker1-smoke/` | Single-worker smoke run artifacts. See `worker1-smoke/AGENTS.md`. |
| `local-check-subagents-enabled/` | Local subagents-enabled check artifacts. See `local-check-subagents-enabled/AGENTS.md`. |
| `local-check-subagents-disabled/` | Local subagents-disabled check artifacts. See `local-check-subagents-disabled/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Team directory names are dynamic and may vary between runs.
- Do not assume historical artifacts here reflect current code behavior without rerunning flows.

### Testing Requirements
- For state-format regressions, run integration/reliability suites and inspect regenerated artifacts.

### Common Patterns
- Each team folder typically includes `phase.json`, optional `monitor-snapshot.json`, `events/`, and `workers/`.

## Dependencies

### Internal
- Produced by `src/state/team-state-store.ts` + `src/team/team-orchestrator.ts`.

### External
- None.

<!-- MANUAL: -->
