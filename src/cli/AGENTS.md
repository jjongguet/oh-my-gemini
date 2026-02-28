<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# cli

## Purpose
Implements the CLI entrypoint (`omg`) and shared command typing/interfaces.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Top-level command dispatcher and global help surface. |
| `types.ts` | Shared CLI IO and parsed-arg/result interfaces. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Concrete command implementations and arg parsing helpers. See `commands/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Keep help text synchronized with actual options/behavior in command modules.
- Preserve dependency injection hooks in `runCli` for testability.

### Testing Requirements
- Run targeted tests for changed command flows and `npm run test:integration` when dispatch behavior changes.

### Common Patterns
- Parse args first, validate input, execute command runner, return explicit exit code.

## Dependencies

### Internal
- Depends on `src/cli/commands/**` and downstream installer/team modules.

### External
- Node process/path utilities only.

<!-- MANUAL: -->
