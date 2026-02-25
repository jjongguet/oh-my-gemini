<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# setup

## Purpose
Provides onboarding and setup documentation, including scope precedence, idempotency expectations, and quickstart command sequences.

## Key Files

| File | Description |
|------|-------------|
| `install-scopes.md` | Scope precedence rules (`CLI > persisted > default`) and setup status semantics. |
| `quickstart.md` | End-to-end bootstrap, setup, smoke, verify, and reliability checklist. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep setup instructions aligned with current script names and required prerequisites.
- Explicitly call out dry-run options where available.

### Testing Requirements
- Validate listed commands in a clean local clone when changing setup docs.

### Common Patterns
- Docs emphasize idempotency and explicit status reporting.

## Dependencies

### Internal
- References `src/installer/**` behavior and `scripts/bootstrap-dev.sh`, `scripts/smoke-install.sh`.

### External
- Node/npm, Gemini CLI, tmux, Docker/Podman prerequisites.

<!-- MANUAL: -->
