<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# src

## Purpose
Primary TypeScript implementation for CLI command handling, setup/install behavior, runtime orchestration, and persisted team state utilities.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `cli/` | CLI entrypoint and command handlers (`setup`, `doctor`, `team run`, `verify`). See `cli/AGENTS.md`. |
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

## Dependencies

### Internal
- `team` depends on `state`; `cli` delegates to `installer`, `team`, and command modules.

### External
- Node core modules (`fs`, `path`, `child_process`, `crypto`) and TypeScript runtime tooling.

<!-- MANUAL: -->
