# Quickstart (MVP)

This quickstart follows the extension-first, tmux-default roadmap for **oh-my-product**.

## Quickstart paths

- **End user path**: install from npm and run `oh-my-product` directly.
- **Contributor path**: clone repo, run npm scripts, and validate changes locally.

## npm migration note

This project now uses **npm** as the default package manager for onboarding and verification.
If you previously used `pnpm`, use the npm equivalents below:

| Previous            | Current                 |
| ------------------- | ----------------------- |
| `pnpm install`      | `npm install`           |
| `pnpm omp <args>`   | `npm run omp -- <args>` |
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
npm install -g oh-my-product
```

Post-global-install contract (required):

```bash
omp setup --scope project
# equivalent
oh-my-product setup --scope project
```

Then continue with extension linking + diagnostics:

```bash
EXT_PATH="$(oh-my-product extension path)"
# setup auto-registers the extension; manual install is only needed as a fallback
gemini extensions install "$EXT_PATH"
oh-my-product doctor
oh-my-product verify
```

### Post-install verification

Gemini's extension preview can emphasize skills over command prompts, so treat the preview screen as a partial summary rather than a full capability list.
Use this verification path after install to confirm the extension assets and command surface directly:

```bash
oh-my-product extension path
oh-my-product doctor --json
oh-my-product team run --task "smoke" --dry-run --json
```

Optional orchestration smoke:

```bash
oh-my-product team run --task "smoke" --workers 3
```

## 3) Contributor bootstrap (repository workflow)

```bash
scripts/bootstrap-dev.sh
```

This script initializes baseline directories and default `.gemini/settings.json` (sandbox=docker).

## 4) Contributor link extension (canonical control plane)

```bash
gemini extensions link .
```

## 5) Setup + Doctor

```bash
npm run setup
# optional: run only when you plan to use subagents backend
npm run setup:subagents
npm run doctor
npm run omp -- doctor --fix --json
# rerun doctor after auto-fix to confirm healthy baseline
npm run doctor
```

`doctor --fix` safely remediates managed issues (for example missing/invalid
`.omp/setup-scope.json` or missing `.omp/state` directory) and then re-runs diagnostics.

Doctor checks include: `node`, `npm`, `gemini-cli`, `tmux`, container runtime
health, the optional `oh-my-product` PATH check for MCP availability, setup
scope validity, extension manifest/command/skill integrity, and `.omp/state`
writeability.

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
Tier bundles are also available (`light`, `standard`, `thorough`):

```bash
npm run omp -- verify --tier light --dry-run --json
npm run omp -- verify --tier standard --dry-run --json
npm run omp -- verify --tier thorough --dry-run --json
```

If verification fails, fix issues and rerun until success.
`--dry-run` is plan-only output (suites are marked `skipped`, not executed pass):

```bash
npm run omp -- verify --dry-run --json
```

Live operator evidence (`start -> status polling -> shutdown`) is collected with `npm run team:e2e -- "..."`.

Installed runtime equivalents:

```bash
oh-my-product verify
oh-my-product verify --dry-run --json
```

## 8) Team run smoke

```bash
scripts/integration-team-run.sh "smoke"
```

This should execute a minimal lifecycle and write state artifacts under `.omp/state/`.
Set `OMP_INTEGRATION_TEAM_WORKERS=<n>` to override the script default (`3`).

Subagent keyword assignment shortcut (`$` or `/` prefixes):

```bash
npm run omp -- team run --task '$planner /executor implement migration smoke'
# installed runtime equivalent:
oh-my-product team run --task '$planner /executor implement migration smoke'
```

Catalog aliases are also accepted (examples: `$plan` -> `planner`,
`/execute` -> `executor`, `/review` -> `code-reviewer`, `/verify` -> `verifier`,
`/handoff` -> `writer`).

Backend keyword shortcuts at task prefix:

```bash
npm run omp -- team run --task '/tmux smoke'
npm run omp -- team run --task '/subagents $planner /executor implement migration smoke'
```

Backend/role precedence contract:

- `--backend` overrides implicit defaulting but must not conflict with backend tags.
- Conflicts fail fast with usage exit code `2` (example: `/tmux /subagents ...`).
- Role tags are only valid on `subagents` backend.

Explicit worker-count contract:

```bash
npm run omp -- team run --task "tmux smoke" --backend tmux --workers 3
# installed runtime equivalent:
oh-my-product team run --task "tmux smoke" --backend tmux --workers 3
```

`--workers` accepts integers `1..8` (default `3`); invalid values fail fast with exit code `2`.
`--max-fix-loop` defaults to `3` and caps verify→fix retries before terminal failure.

Lifecycle operator commands (state-driven):

```bash
npm run omp -- team status --team oh-my-product --json
npm run omp -- team resume --team oh-my-product --task "resume smoke" --dry-run --json
npm run omp -- team shutdown --team oh-my-product --force --json
```

Explicit subagent assignment contract (workers must match assignments):

```bash
npm run omp -- team run --task "subagents smoke" --backend subagents --subagents planner,executor --workers 2
# installed runtime equivalent:
oh-my-product team run --task "subagents smoke" --backend subagents --subagents planner,executor --workers 2
```

Alias inputs resolve to canonical roles, so `--subagents review,code-reviewer`
maps to one `code-reviewer` assignment.

Subagents evidence artifacts are persisted per role under:

```text
.omp/state/team/<team>/artifacts/roles/worker-<n>/<role>.{json,md}
```

If required role artifacts/evidence are missing, `team run` cannot finish in
`completed` phase (role contract gate fails deterministically).

Team lifecycle control commands:

```bash
npm run omp -- team status --team oh-my-product --json
npm run omp -- team resume --team oh-my-product --max-fix-loop 1
npm run omp -- team shutdown --team oh-my-product --force --json
```

Installed runtime equivalents:

```bash
oh-my-product team status --team oh-my-product --json
oh-my-product team resume --team oh-my-product --max-fix-loop 1
oh-my-product team shutdown --team oh-my-product --force --json
```

## 9) Reliability gate checks

```bash
npm run test:reliability
npm run test:verification
npm run omp -- verify --suite reliability
# installed runtime equivalent:
oh-my-product verify --suite reliability
```

Reliability coverage includes worker health/claim contracts:

- `tests/reliability/worker-heartbeat.test.ts` (heartbeat signal schema + persistence)
- `tests/reliability/worker-task-claims.test.ts` (task claim token flow, release, and failure paths)

Optional threshold tuning for reliability troubleshooting:

```bash
npm run omp -- team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
```

## 10) Optional live OMX Team e2e (operator path)

```bash
npm run team:e2e -- "oh-my-product live team smoke"
```

Use this when you need evidence for real `omx team` lifecycle operations
(`start -> status polling -> shutdown`).

Recommended release order:

```bash
npm run gate:3
npm run team:e2e -- "oh-my-product release gate live evidence"
```

## 11) Repository structure (at a glance)

```text
src/                  # core CLI + installer + team orchestrator + state
commands/             # Gemini slash command TOMLs (/omp:*)
skills/               # packaged Gemini extension skills
scripts/              # bootstrap/smoke/docker/e2e helpers
tests/                # smoke/integration/reliability suites
docs/                 # setup/architecture/testing docs
.github/workflows/    # CI and release workflows
```
