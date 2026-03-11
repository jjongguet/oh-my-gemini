<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# cli

## Purpose
Implements the `omg` CLI entrypoint, command dispatch, shared CLI typing, and CLI-exposed tool server helpers.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Top-level CLI dispatcher and global help/version handling. |
| `types.ts` | Shared CLI IO and parsed-arg/result interfaces. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Concrete CLI command implementations and shared command helpers (see `commands/AGENTS.md`). |
| `tools/` | CLI-exposed file/git/http/process tool registry and MCP server helpers (see `tools/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep CLI help text, option parsing, and returned exit codes synchronized with actual command behavior.
- Preserve dependency-injection seams in the dispatcher so commands remain testable.

### Testing Requirements
- Run targeted command tests and `npm run test:integration` when dispatch or user-facing CLI behavior changes.

### Common Patterns
- Parse args first, validate inputs, execute a command runner, then return an explicit exit code.
- CLI-exposed tool helpers live alongside the CLI but remain separate from core implementation registries under `src/tools/`.

## Dependencies

### Internal
- Depends on `src/cli/commands/**`, `src/cli/tools/**`, and downstream installer/team/verification modules.

### External
- Node process/path utilities only.

<!-- MANUAL: -->
