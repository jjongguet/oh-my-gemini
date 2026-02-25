<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# skills

## Purpose
Hosts extension-level skills that provide reusable structured workflows for Gemini extension users.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `plan/` | Planning skill aligned with roadmap gates and verification checklists. See `plan/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Keep skill instructions scoped, deterministic, and tied to observable acceptance criteria.

### Testing Requirements
- Validate that command examples and phase labels still match current docs/code.

### Common Patterns
- Skills use frontmatter (`name`, `description`) plus a repeatable execution template.

## Dependencies

### Internal
- Aligns with roadmap docs under `docs/` and CLI capabilities under `src/cli`.

### External
- Gemini skill invocation model.

<!-- MANUAL: -->
