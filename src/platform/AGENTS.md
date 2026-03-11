<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# platform

## Purpose
Cross-platform environment, OS, shell, and process utility layer used by CLI and runtime code.

## Key Files

| File | Description |
|------|-------------|
| `environment.ts` | Environment filtering, allowlist, and normalization helpers. |
| `os.ts` | Platform, WSL, and path normalization helpers. |
| `process-utils.ts` | Process-tree and command helper functions. |
| `shell-adapter.ts` | POSIX/CMD shell resolution and quoting helpers. |
| `index.ts` | Public platform exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Centralize OS-specific branching here instead of scattering platform checks across the codebase.

### Testing Requirements
- Run `npm run typecheck` and targeted platform tests when OS/path/process behavior changes.

### Common Patterns
- Pure environment/path detection helpers plus thin process wrappers.

## Dependencies

### Internal
- Consumed by CLI commands, runtime tooling, and feature-level helpers.

### External
- Node child-process, filesystem, path, and util APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
