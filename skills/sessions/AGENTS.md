<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# sessions

## Purpose
Defines the packaged `sessions` extension skill. Inspect recorded session history and summarize recent runs with metadata.

## Key Files

| File | Description |
|------|-------------|
| `SKILL.md` | Workflow definition, frontmatter metadata, and usage examples for the `sessions` skill. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep frontmatter metadata and examples aligned with the actual OMG commands, docs, and workflow surfaces referenced by the skill.
- Treat this file as packaged/public skill UX rather than implementation logic.

### Testing Requirements
- Manual validation: confirm any referenced commands, flags, or artifact paths still exist before changing this skill.

### Common Patterns
- Single-directory skill package with one `SKILL.md` file containing frontmatter plus reusable workflow instructions.

## Dependencies

### Internal
- Related runtime discovery and dispatch logic lives under `src/skills/`.
- Skill examples should stay consistent with `commands/`, `docs/`, and the current CLI implementation.

### External
- Gemini extension skill runtime.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
