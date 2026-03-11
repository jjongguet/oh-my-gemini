<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# api

## Purpose
Reference documentation for public commands, configuration surfaces, and implementation-facing APIs that contributors may need to inspect without reading the entire codebase.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | API and command reference overview for the repository. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep reference details source-backed and distinguish stable public surfaces from implementation internals.
- Prefer explicit command flags, file paths, and exported symbol names over vague summaries.

### Testing Requirements
- Validate every documented command and path against the current CLI help output and repository layout.

### Common Patterns
- Long-form reference sections, tables, and path-based documentation.

## Dependencies

### Internal
- Draws from `src/**`, `package.json`, `commands/`, and the OMG-specific docs under `docs/omg/`.

### External
- Markdown reference consumers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
