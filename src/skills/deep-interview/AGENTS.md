<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# deep-interview

## Purpose
Bundled runtime `deep-interview` skill asset used by OMG itself. Run a structured Socratic interview before planning or execution.

## Key Files

| File | Description |
|------|-------------|
| `SKILL.md` | Bundled runtime skill prompt and metadata for `deep-interview`. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Treat `SKILL.md` as the single source of truth for this bundled skill asset.
- Keep terminology aligned with the current runtime command and verification surfaces.

### Testing Requirements
- Run `npm run typecheck` and any targeted skill-resolver tests if discovery or frontmatter expectations change.

### Common Patterns
- Single-directory bundled skill asset with one `SKILL.md` file.

## Dependencies

### Internal
- Discovered by `src/skills/resolver.ts` and surfaced through `src/skills/dispatcher.ts`.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
