<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# .github

## Purpose
Houses repository automation for GitHub, primarily CI workflows.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | CI pipeline definitions. See `workflows/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Keep CI steps aligned with current package manager and script surface.
- Prefer explicit, deterministic command invocations with clear failure signals.

### Testing Requirements
- After workflow edits, run equivalent local commands where possible.
- Ensure referenced scripts/commands exist and match repository tooling.

### Common Patterns
- Single workflow file drives typecheck/build/smoke/integration/reliability checks.

## Dependencies

### Internal
- Executes repository scripts under `scripts/` and npm script targets from `package.json`.

### External
- GitHub Actions runners and marketplace actions (`actions/checkout`, `actions/setup-node`, etc.).

<!-- MANUAL: -->
