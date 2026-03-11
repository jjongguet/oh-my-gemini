<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# utils

## Purpose
Small utility directory currently focused on security validation helpers for shell-safe values, paths, team names, and task IDs.

## Key Files

| File | Description |
|------|-------------|
| `security.ts` | Shell/path/team/task validation helpers used to harden runtime inputs. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep validators explicit, side-effect free, and conservative about what they allow.

### Testing Requirements
- Run `npm run typecheck` and targeted security/validation tests when regexes or constraints change.

### Common Patterns
- Regex-backed validation helpers with clear error messages.

## Dependencies

### Internal
- Used by commands, runtime helpers, and any code that validates user-supplied identifiers or paths.

### External
- Node path utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
