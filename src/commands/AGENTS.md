<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# commands

## Purpose
Thin feature-layer helper for discovering, listing, and expanding packaged TOML command templates.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Command-template lookup, listing, and prompt expansion helpers built on extension-path resolution. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep this directory as a lightweight facade over packaged command assets rather than a second CLI dispatcher.

### Testing Requirements
- Run `npm run typecheck` and targeted command-template tests when command lookup or expansion changes.

### Common Patterns
- Single-file facade over `commands/` asset discovery and `src/cli/commands/extension-path.ts`.

## Dependencies

### Internal
- Depends on `src/cli/commands/extension-path.ts` and packaged command assets under `commands/`.

### External
- Node filesystem/path utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
