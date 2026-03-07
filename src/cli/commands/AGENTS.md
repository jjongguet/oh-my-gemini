<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# commands

## Purpose
Holds concrete implementations for `setup`, `doctor`, `team run`, and `verify`, plus shared argument parsing utilities.

## Key Files

| File | Description |
|------|-------------|
| `arg-utils.ts` | Shared parser and typed option helpers (string/flag/boolean). |
| `setup.ts` | Scope-aware setup command wrapper around installer API. |
| `doctor.ts` | Local dependency/runtime prerequisite diagnostics. |
| `team-run.ts` | Team run command, backend selection, subagent keyword parsing, and output formatting. |
| `team-status.ts` | Team status command for persisted phase/snapshot/task summary and resume readiness hints. |
| `team-resume.ts` | Team resume command that rehydrates run defaults from persisted state. |
| `team-shutdown.ts` | Team shutdown command for runtime teardown + state cleanup (`--force` supported). |
| `team-lifecycle-state.ts` | Shared lifecycle state helpers for persisting resume input snapshots. |
| `tools.ts` | Built-in CLI MCP tools command surface (`list`, `serve`, `manifest`). |
| `verify.ts` | Verification suite runner (`smoke`, `integration`, `reliability`). |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Maintain deterministic exit-code semantics (`0` success, `1` runtime failure, `2` usage/validation errors).
- Keep JSON output shapes stable for integration tests.
- Preserve subagent keyword parsing behavior (`$role`, `/role`) at task prefix only.

### Testing Requirements
- Run targeted reliability tests for option parsing and output contracts:
  - `npm run test:reliability`
  - `npm run test:integration`

### Common Patterns
- Help-printer per command, parser + validation block, execution runner abstraction for injection.

## Dependencies

### Internal
- Uses `src/installer`, `src/team/team-orchestrator`, and helper utilities.

### External
- Child process spawn for doctor/verify command execution.

<!-- MANUAL: -->
