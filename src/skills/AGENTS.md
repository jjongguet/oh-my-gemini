<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# skills

## Purpose
Runtime skill discovery, frontmatter parsing, dispatch helpers, and bundled skill prompt assets used by OMG itself.

## Key Files

| File | Description |
|------|-------------|
| `resolver.ts` | Filesystem discovery, frontmatter parsing, and skill resolution/listing. |
| `dispatcher.ts` | Skill dispatch entrypoints and result helpers. |
| `index.ts` | Public skill API exports. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `cancel/` | Bundled cancel skill asset (see `cancel/AGENTS.md`). |
| `configure-notifications/` | Bundled notification-setup skill asset (see `configure-notifications/AGENTS.md`). |
| `debug/` | Bundled debug skill asset (see `debug/AGENTS.md`). |
| `deep-interview/` | Bundled deep-interview skill asset (see `deep-interview/AGENTS.md`). |
| `execute/` | Bundled execute skill asset (see `execute/AGENTS.md`). |
| `handoff/` | Bundled handoff skill asset (see `handoff/AGENTS.md`). |
| `help/` | Bundled help skill asset (see `help/AGENTS.md`). |
| `review/` | Bundled review skill asset (see `review/AGENTS.md`). |
| `status/` | Bundled status skill asset (see `status/AGENTS.md`). |
| `verify/` | Bundled verify skill asset (see `verify/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep filesystem discovery, frontmatter parsing, and dispatch behavior centralized in `resolver.ts` and `dispatcher.ts`.
- Differentiate these bundled runtime assets from the packaged extension-facing skills under the repository-root `skills/` directory.

### Testing Requirements
- Run `npm run typecheck` and targeted skill resolver/dispatcher tests when discovery or dispatch behavior changes.

### Common Patterns
- Resolve default skill directories -> parse `SKILL.md` -> build a `ResolvedSkill` -> dispatch or list.

## Dependencies

### Internal
- Used by CLI skill surfaces and MCP/tool integrations that expose skills.

### External
- Node filesystem/path utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
