<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# tests

## Purpose
Verification harness for `oh-my-gemini`, organized by smoke, integration, and reliability scopes with shared runtime helpers.

## Key Files
No direct test files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `smoke/` | Fast setup/sandbox baseline checks. See `smoke/AGENTS.md`. |
| `integration/` | End-to-end command and lifecycle behavior checks. See `integration/AGENTS.md`. |
| `reliability/` | Failure-path and deterministic reliability hardening tests. See `reliability/AGENTS.md`. |
| `utils/` | Shared command/tempdir helpers for tests. See `utils/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Prefer deterministic, environment-aware tests with `runIf/skipIf` when external tooling may be absent.
- Keep assertions explicit about exit codes, output contracts, and persisted artifacts.

### Testing Requirements
- Run targeted suites for touched tests, then full suite when cross-cutting:
  - `npm run test:smoke`
  - `npm run test:integration`
  - `npm run test:reliability`

### Common Patterns
- Temporary workspace setup via `tests/utils/runtime.ts`.
- CLI invocation through local entrypoint wrappers (`runOmg`).

## Dependencies

### Internal
- Exercises modules in `src/` and scripts under `scripts/`.

### External
- Vitest + host tool availability (tmux, gemini, docker/podman) for non-skipped live checks.

<!-- MANUAL: -->
