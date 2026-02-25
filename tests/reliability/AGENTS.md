<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# reliability

## Purpose
Covers deterministic failure paths, watchdog/non-reporting detection, and backend-specific edge cases for orchestration hardening.

## Key Files

| File | Description |
|------|-------------|
| `dead-worker-watchdog.test.ts` | Unit tests for health monitor dead/non-reporting/watchdog semantics. |
| `orchestrator-failure-paths.test.ts` | Simulates orchestrator fix-loop caps, monitor failures, and persisted worker signal merges. |
| `subagents-backend.test.ts` | Subagents backend prerequisite, selection, and deterministic snapshot behavior. |
| `subagents-orchestrator.test.ts` | Orchestrator run success path with subagents backend assignment. |
| `team-run-subagents-options.test.ts` | CLI option + keyword parsing coverage for subagent assignment flags/tags. |
| `verify-command-package-manager.test.ts` | Ensures verify command surfaces npm-based suite commands. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Prefer deterministic fakes/stubs over flaky live runtime dependencies.
- Keep assertions focused on failure reasons and persisted phase/snapshot side-effects.

### Testing Requirements
- Always run `npm run test:reliability` after edits.
- If CLI option parsing changed, also run integration suite.

### Common Patterns
- Uses temp directories and synthetic runtime backends to isolate edge behavior.

## Dependencies

### Internal
- Exercises `src/team/**`, `src/state/**`, and CLI command modules.

### External
- Vitest only (tests avoid mandatory live external runtime by design).

<!-- MANUAL: -->
