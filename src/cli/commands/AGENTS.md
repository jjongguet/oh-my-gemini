<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# commands

## Purpose
Concrete CLI command implementations for setup, doctor, team lifecycle, skills, tools, sessions, HUD, MCP, PRD, and verification flows.

## Key Files

| File | Description |
|------|-------------|
| `arg-utils.ts` | Shared parser and typed option helpers used across command implementations. |
| `doctor.ts` | Environment and prerequisite diagnostics command. |
| `setup.ts` | Scope-aware setup command that delegates to installer logic. |
| `team-run.ts` | Team-run command with backend selection and task/worker orchestration options. |
| `worker-run.ts` | Worker execution entrypoint that consumes pre-assigned task context and emits state updates. |
| `skill.ts` | Skill discovery and invocation command surface. |
| `tools.ts` | CLI tools list/serve/manifest command surface. |
| `verify.ts` | Verification suite runner and report formatter. |
| `hud.ts` | HUD render/watch command surface. |
| `mcp.ts` | MCP server/client entry command surface. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Maintain deterministic exit-code semantics and stable JSON/text output shapes for tested command paths.
- Keep option parsing centralized in shared helpers and validate inputs before invoking downstream logic.
- When adding a command here, update help/dispatch surfaces and any packaged prompt assets that reference it.

### Testing Requirements
- Run targeted reliability and integration tests for any changed command behavior or output contract.
- Use `npm run test:integration` for user-facing command flow changes and `npm run test:reliability` for parsing/state-contract changes.

### Common Patterns
- Per-command help printer, parse/validate block, then execution runner abstraction.
- Team lifecycle commands share helpers in `team-command-shared.ts` and related state modules.

## Dependencies

### Internal
- Delegates into installer, team, state, skill, tool, PRD, notification, and verification modules.

### External
- Child-process spawning for commands that shell out to underlying tools.

<!-- MANUAL: -->
