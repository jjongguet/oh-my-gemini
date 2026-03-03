# Quickstart (MVP)

This quickstart follows the extension-first, tmux-default roadmap for **oh-my-gemini**.

## Quickstart paths

- **End user path**: install from npm and run `oh-my-gemini` directly.
- **Contributor path**: clone repo, run npm scripts, and validate changes locally.

## npm migration note

This project now uses **npm** as the default package manager for onboarding and verification.
If you previously used `pnpm`, use the npm equivalents below:

| Previous            | Current                 |
| ------------------- | ----------------------- |
| `pnpm install`      | `npm install`           |
| `pnpm omg <args>`   | `npm run omg -- <args>` |
| `pnpm test:<suite>` | `npm run test:<suite>`  |

## 1) Prerequisites

Install required tools:

- Node.js 20+
- `npm`
- Gemini CLI (`@google/gemini-cli`)
- `tmux`
- Docker or Podman (or compatible container runtime)

Quick checks:

```bash
node -v
npm -v
gemini --version
tmux -V
docker --version
# optional if you use Podman instead of Docker
podman --version
```

## 2) End user install (npm, no local build)

```bash
npm install -g oh-my-gemini-sisyphus
```

Post-global-install contract (required):

```bash
omg setup --scope project
# equivalent
oh-my-gemini setup --scope project
```

Then continue with extension linking + diagnostics:

```bash
EXT_PATH="$(oh-my-gemini extension path)"
gemini extensions link "$EXT_PATH"
oh-my-gemini doctor
oh-my-gemini verify
```

Optional orchestration smoke:

```bash
oh-my-gemini team run --task "smoke" --workers 3
```

## 3) Contributor bootstrap (repository workflow)

```bash
scripts/bootstrap-dev.sh
```

This script initializes baseline directories and default `.gemini/settings.json` (sandbox=docker).

## 4) Contributor link extension (canonical control plane)

```bash
gemini extensions link ./extensions/oh-my-gemini
```

## 5) Setup + Doctor

```bash
npm run setup
# optional: run only when you plan to use subagents backend
npm run setup:subagents
npm run doctor
npm run omg -- doctor --fix --json
# rerun doctor after auto-fix to confirm healthy baseline
npm run doctor
```

`doctor --fix` safely remediates managed issues (for example missing/invalid
`.omg/setup-scope.json` or missing `.omg/state` directory) and then re-runs diagnostics.

Doctor checks include: `node`, `npm`, `gemini-cli`, `tmux`, container runtime
health, setup scope validity, extension manifest/command/skill integrity, and
`.omg/state` writeability.

`npm run setup` now provisions:

- `.gemini/settings.json` sandbox baseline,
- managed `.gemini/GEMINI.md` guidance block,
- `.gemini/sandbox.Dockerfile`,
- `.gemini/agents/catalog.json` (oh-my-claudecode-inspired team subagents, unified model).

## 6) Sandbox smoke

```bash
scripts/sandbox-smoke.sh
```

Expected signal: command completes successfully and reports sandbox output.

If you only want to validate project wiring (without a live Gemini sandbox call):

```bash
scripts/sandbox-smoke.sh --dry-run
```

Optional clean-room Docker checks:

```bash
# baseline clean-room checks
npm run test:docker

# keep container alive for inspection
npm run test:docker:keep

# full live smoke (requires API key auth)
export GEMINI_API_KEY="your-key"
npm run test:docker:full
```

## 7) Verify harness

```bash
npm run verify
```

By default this runs `typecheck`, `smoke`, `integration`, and `reliability`.
If verification fails, fix issues and rerun until success.
`--dry-run` is plan-only output (suites are marked `skipped`, not executed pass):

```bash
npm run omg -- verify --dry-run --json
```

Live operator evidence (`start -> status polling -> shutdown`) is collected with `npm run team:e2e -- "..."`.

Installed runtime equivalents:

```bash
oh-my-gemini verify
oh-my-gemini verify --dry-run --json
```

## 8) Team run smoke

```bash
scripts/integration-team-run.sh "smoke"
```

This should execute a minimal lifecycle and write state artifacts under `.omg/state/`.
Set `OMG_INTEGRATION_TEAM_WORKERS=<n>` to override the script default (`3`).

Subagent keyword assignment shortcut (`$` or `/` prefixes):

```bash
npm run omg -- team run --task '$planner /executor implement migration smoke'
# installed runtime equivalent:
oh-my-gemini team run --task '$planner /executor implement migration smoke'
```

Catalog aliases are also accepted (examples: `$plan` -> `planner`,
`/execute` -> `executor`, `/review` -> `code-reviewer`, `/verify` -> `verifier`,
`/handoff` -> `writer`).

Backend keyword shortcuts at task prefix:

```bash
npm run omg -- team run --task '/tmux smoke'
npm run omg -- team run --task '/subagents $planner /executor implement migration smoke'
```

Backend/role precedence contract:

- `--backend` overrides implicit defaulting but must not conflict with backend tags.
- Conflicts fail fast with usage exit code `2` (example: `/tmux /subagents ...`).
- Role tags are only valid on `subagents` backend.

Explicit worker-count contract:

```bash
npm run omg -- team run --task "tmux smoke" --backend tmux --workers 3
# installed runtime equivalent:
oh-my-gemini team run --task "tmux smoke" --backend tmux --workers 3
```

`--workers` accepts integers `1..8` (default `3`); invalid values fail fast with exit code `2`.
`--max-fix-loop` defaults to `3` and caps verify→fix retries before terminal failure.

Lifecycle operator commands (state-driven):

```bash
npm run omg -- team status --team oh-my-gemini --json
npm run omg -- team resume --team oh-my-gemini --task "resume smoke" --dry-run --json
npm run omg -- team shutdown --team oh-my-gemini --force --json
```

Explicit subagent assignment contract (workers must match assignments):

```bash
npm run omg -- team run --task "subagents smoke" --backend subagents --subagents planner,executor --workers 2
# installed runtime equivalent:
oh-my-gemini team run --task "subagents smoke" --backend subagents --subagents planner,executor --workers 2
```

Alias inputs resolve to canonical roles, so `--subagents review,code-reviewer`
maps to one `code-reviewer` assignment.

Subagents evidence artifacts are persisted per role under:

```text
.omg/state/team/<team>/artifacts/roles/worker-<n>/<role>.{json,md}
```

If required role artifacts/evidence are missing, `team run` cannot finish in
`completed` phase (role contract gate fails deterministically).

Team lifecycle control commands:

```bash
npm run omg -- team status --team oh-my-gemini --json
npm run omg -- team resume --team oh-my-gemini --max-fix-loop 1
npm run omg -- team shutdown --team oh-my-gemini --force --json
```

Installed runtime equivalents:

```bash
oh-my-gemini team status --team oh-my-gemini --json
oh-my-gemini team resume --team oh-my-gemini --max-fix-loop 1
oh-my-gemini team shutdown --team oh-my-gemini --force --json
```

## 9) Reliability gate checks

```bash
npm run test:reliability
npm run omg -- verify --suite reliability
# installed runtime equivalent:
oh-my-gemini verify --suite reliability
```

Reliability coverage includes worker health/claim contracts:

- `tests/reliability/worker-heartbeat.test.ts` (heartbeat signal schema + persistence)
- `tests/reliability/worker-task-claims.test.ts` (task claim token flow, release, and failure paths)

Optional threshold tuning for reliability troubleshooting:

```bash
npm run omg -- team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
```

## 10) Optional live OMX Team e2e (operator path)

```bash
npm run team:e2e -- "oh-my-gemini live team smoke"
```

Use this when you need evidence for real `omx team` lifecycle operations
(`start -> status polling -> shutdown`).

Recommended release order:

```bash
npm run gate:3
npm run team:e2e -- "oh-my-gemini release gate live evidence"
```

## 11) Repository structure (at a glance)

```text
src/                      # core CLI + installer + team orchestrator + state
extensions/oh-my-gemini/  # canonical Gemini extension package
scripts/                  # bootstrap/smoke/docker/e2e helpers
tests/                    # smoke/integration/reliability suites
docs/                     # setup/architecture/testing docs
.github/workflows/        # CI and release workflows
```
