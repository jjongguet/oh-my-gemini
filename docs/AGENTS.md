<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# docs

## Purpose
Contains human-readable project documentation covering architecture boundaries, setup/runbooks, and acceptance/test gates.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `architecture/` | Runtime/backend boundaries and contract documentation. See `architecture/AGENTS.md`. |
| `setup/` | Installation, scope precedence, and quickstart docs. See `setup/AGENTS.md`. |
| `testing/` | Gate criteria and operator runbooks for verification. See `testing/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Keep docs synchronized with real command names in `package.json` and CLI help output.
- Prefer actionable examples that users can copy/paste.

### Testing Requirements
- Validate markdown examples against current scripts/commands.
- If behavior changed in code, update docs in same change set.

### Common Patterns
- Docs are organized by concern: architecture, setup flow, and testing gates.

## Dependencies

### Internal
- Reflects behavior implemented under `src/`, `scripts/`, and `tests/`.

### External
- Markdown docs consumed by developers and AI agents.

<!-- MANUAL: -->
