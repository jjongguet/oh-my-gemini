<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# tests

## Purpose
Verification harness for `oh-my-gemini`, organized into smoke, integration, reliability, e2e, and shared test utility scopes.

## Key Files

No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `smoke/` | Fast setup and packaging confidence checks (see `smoke/AGENTS.md`). |
| `integration/` | Multi-module command and lifecycle behavior tests (see `integration/AGENTS.md`). |
| `reliability/` | Deterministic edge-case and failure-path hardening tests (see `reliability/AGENTS.md`). |
| `e2e/` | Live end-to-end tests that use real external integrations when gated env vars are present (see `e2e/AGENTS.md`). |
| `utils/` | Shared test helpers for temp dirs, command execution, and runtime setup (see `utils/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Prefer deterministic tests with explicit skip gates when external tooling or secrets are optional.
- Keep assertions concrete about exit codes, state artifacts, and observable behavior rather than internal implementation trivia.

### Testing Requirements
- Run the most relevant suite(s) after changes: `npm run test:smoke`, `npm run test:integration`, `npm run test:reliability`, or `npm run test:e2e` when live credentials are available.
- Cross-cutting runtime changes often need multiple suites, not just a single test file.

### Common Patterns
- Shared helpers live in `tests/utils/`; higher-level suites should call public commands and state surfaces.
- E2E tests are gated and should not fail spuriously when secrets are absent.

## Dependencies

### Internal
- Exercises modules under `src/` and shell scripts under `scripts/`.

### External
- Vitest plus host tooling such as tmux, gemini CLI, Docker/Podman, and live Gemini API credentials for gated paths.

<!-- MANUAL: -->
