<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# utils

## Purpose
Shared helpers for test process execution, temporary workspace setup/cleanup, and fixture snapshot capture.

## Key Files

| File | Description |
|------|-------------|
| `runtime.ts` | Utility wrappers for running commands/CLI, checking command presence, and temp-dir lifecycle. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep helper APIs stable because many suites depend on them.
- Preserve cross-platform-safe command invocation and shell escaping behavior.

### Testing Requirements
- Run at least one suite from each category (`smoke`, `integration`, `reliability`) after helper changes.

### Common Patterns
- Uses `spawnSync` wrappers returning `{status, stdout, stderr}` for deterministic assertions.

## Dependencies

### Internal
- Imported across all test suites.

### External
- Node child_process/fs/path/os primitives.

<!-- MANUAL: -->
