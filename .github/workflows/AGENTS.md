<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-03T07:46:00Z -->

# workflows

## Purpose
Defines CI and CD behavior for pull requests, pushes, and npm releases. Two workflows are active: `ci.yml` (quality gates on every push/PR) and `release.yml` (npm publishing on main pushes when version changes).

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | Runs on all pushes and PRs. Three sequential jobs: `global_install_contract_blocking` → `quality_blocking` → `signal_non_blocking`. Enforces typecheck, build, smoke, integration, reliability, and verify gates. |
| `release.yml` | Runs on push to `main`, push to `v*` tags, or `workflow_dispatch`. Jobs: `pre_release_blocking` (full gate) + `check_version` (compare local vs npm registry) + `publish_npm` (publishes if version differs or manual trigger with `publish=true`). Requires `NPM_TOKEN` secret. |

## Subdirectories
No subdirectories.

## Workflow Details

### ci.yml
Triggers: all `push` events and all `pull_request` events.

Job pipeline (each job depends on the previous):

| Job | Blocking | Steps |
|-----|----------|-------|
| `global_install_contract_blocking` | Yes | `gate:legacy-bypass`, `gate:global-install-contract` |
| `quality_blocking` | Yes | `gate:legacy-bypass`, typecheck, build, smoke tests, integration tests, reliability tests, verify |
| `signal_non_blocking` | No (`continue-on-error`, `if: always()`) | Setup idempotency smoke, sandbox dry-run smoke, team lifecycle integration, Docker clean-room smoke, Docker full Gemini live smoke (key-auth only) |

### release.yml
Triggers: push to `main` branch, push to `v*` tags, `workflow_dispatch` (with optional `publish` boolean input).

Job pipeline:

| Job | Depends On | Condition | Purpose |
|-----|-----------|-----------|---------|
| `pre_release_blocking` | — | Always | Full gate: legacy-bypass, global-install-contract, typecheck, build, smoke, integration, reliability, verify |
| `check_version` | — | Always | Compares `package.json` version against `npm view oh-my-gemini-sisyphus version`; outputs `should_publish` |
| `publish_npm` | `pre_release_blocking`, `check_version` | `should_publish == 'true'` OR `workflow_dispatch` with `publish=true` | Publishes to npm with `--provenance` using `NPM_TOKEN` |

## Publishing Workflow

To release a new version to npm:

1. Bump `version` in `package.json` (e.g., `0.1.0` → `0.1.1`).
2. Commit and push to `main`.
3. `release.yml` triggers automatically.
4. `check_version` detects the version difference and sets `should_publish=true`.
5. `publish_npm` runs after `pre_release_blocking` passes and publishes the package.

Manual publish (without version bump): trigger `workflow_dispatch` with `publish=true`.

## For AI Agents

### Working In This Directory
- Keep command usage consistent with active package manager strategy (`npm ci`, `npm run ...`).
- Ensure prerequisite tooling (e.g., tmux) is installed in jobs that run orchestration or Docker tests.
- `NPM_TOKEN` must be configured as a GitHub Actions secret in repository settings for `publish_npm` to succeed.
- The publish step uses `--provenance`; the workflow requires `id-token: write` permission for OIDC.

### Testing Requirements
- Rehearse workflow commands locally (`npm run typecheck`, `npm run build`, suite commands) before finalizing CI changes.
- Validate `check_version` logic with `npm view oh-my-gemini-sisyphus version` to confirm registry state before testing release logic.

### Common Patterns
- `ci.yml` is linear and fail-fast for blocking jobs; non-blocking signals use `continue-on-error: true` with `if: always()`.
- `release.yml` gates publish behind both a full quality pass (`pre_release_blocking`) and a version-difference check (`check_version`), preventing redundant publishes.

## Dependencies

### Internal
- References scripts under `scripts/` and CLI/test scripts in `package.json`.

### External
- GitHub Actions ecosystem + Ubuntu runner toolchain.
- npm registry (`registry.npmjs.org`) for version comparison and publishing.
- `NPM_TOKEN` GitHub secret for authenticated publish.

<!-- MANUAL: -->
