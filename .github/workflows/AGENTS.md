<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# workflows

## Purpose
Defines CI behavior for pull requests and pushes.

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | End-to-end CI job: install deps, typecheck/build, smoke/integration/reliability gates, and verify command execution. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep command usage consistent with active package manager strategy.
- Ensure prerequisite tooling (e.g., tmux) is installed before tests requiring it.

### Testing Requirements
- Rehearse workflow commands locally (`npm run typecheck`, `npm run build`, suite commands) before finalizing CI changes.

### Common Patterns
- Workflow is linear and fail-fast; each gate corresponds to documented roadmap checks.

## Dependencies

### Internal
- References scripts under `scripts/` and CLI/test scripts in `package.json`.

### External
- GitHub Actions ecosystem + Ubuntu runner toolchain.

<!-- MANUAL: -->
