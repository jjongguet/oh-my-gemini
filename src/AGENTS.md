<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-03T07:46:00Z -->

# src

## Purpose
Primary TypeScript implementation for CLI command handling, setup/install behavior, runtime orchestration, and persisted team state utilities.

## Key Files

| File | Description |
|------|-------------|
| `constants.ts` | Top-level shared constants (e.g., state directory paths). |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `cli/` | CLI entrypoint and command handlers (`setup`, `doctor`, `team run`, `verify`). See `cli/AGENTS.md`. |
| `common/` | Shared utility modules (e.g., team name generation). See `common/AGENTS.md`. |
| `installer/` | Setup orchestration, marker merging, and scope precedence persistence. See `installer/AGENTS.md`. |
| `state/` | JSON/NDJSON filesystem helpers and team state persistence APIs. See `state/AGENTS.md`. |
| `team/` | Team orchestrator, health monitor, runtime abstraction, and subagent catalog logic. See `team/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Maintain strict TypeScript types and Node ESM import conventions.
- Keep runtime behavior deterministic and explicit in error reporting.

### Testing Requirements
- Minimum: `npm run typecheck` + targeted tests for touched modules.
- For orchestration changes, include `npm run test:reliability`.

### Common Patterns
- Dependency injection for testability in command handlers.
- Structured interfaces for persisted state and runtime contracts.
- Worker heartbeat payloads are built with `buildHeartbeatSignal()` in `src/team/worker-signals.ts` and written by `src/cli/commands/worker-run.ts` (initial + every 30s via `setInterval` + terminal `alive: false`).
- Atomic pre-assignment is orchestrator-owned: `TeamOrchestrator.preClaimTasksForWorkers()` claims pending/unknown tasks before backend start and passes claims via `TeamStartInput.taskClaims` (`TaskClaimEntry` in `src/team/types.ts`).

## Dependencies

### Internal
- `team` depends on `state`; `cli` delegates to `installer`, `team`, and command modules.

### External
- Node core modules (`fs`, `path`, `child_process`, `crypto`) and TypeScript runtime tooling.

<!-- MANUAL: -->
