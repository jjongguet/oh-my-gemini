# Quickstart (MVP)

This quickstart follows the extension-first, tmux-default roadmap for **oh-my-gemini**.

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

## 2) Bootstrap workspace

```bash
scripts/bootstrap-dev.sh
```

This script initializes baseline directories and default `.gemini/settings.json` (sandbox=docker).

## 3) Link extension (canonical control plane)

```bash
gemini extensions link ./extensions/oh-my-gemini
```

## 4) Setup + Doctor

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

## 5) Sandbox smoke

```bash
scripts/sandbox-smoke.sh
```

Expected signal: command completes successfully and reports sandbox output.

If you only want to validate project wiring (without a live Gemini sandbox call):

```bash
scripts/sandbox-smoke.sh --dry-run
```

## 6) Verify harness

```bash
npm run verify
```

By default this runs `smoke`, `integration`, and `reliability`.
If verification fails, fix issues and rerun until success.
`--dry-run` is plan-only output (suites are marked `skipped`, not executed pass):

```bash
npm run omg -- verify --dry-run --json
```

Live operator evidence (`start -> status polling -> shutdown`) is collected with `npm run team:e2e -- "..."`.

## 7) Team run smoke

```bash
scripts/integration-team-run.sh "smoke"
```

This should execute a minimal lifecycle and write state artifacts under `.omg/state/`.
Set `OMG_INTEGRATION_TEAM_WORKERS=<n>` to override the script default (`3`).

Subagent keyword assignment shortcut (`$` or `/` prefixes):

```bash
npm run omg -- team run --task '$planner /executor implement migration smoke'
```

Explicit worker-count contract:

```bash
npm run omg -- team run --task "tmux smoke" --backend tmux --workers 3
```

`--workers` accepts integers `1..8` (default `3`); invalid values fail fast with exit code `2`.
`--max-fix-loop` defaults to `3` and caps verify→fix retries before terminal failure.

Explicit subagent assignment contract (workers must match assignments):

```bash
npm run omg -- team run --task "subagents smoke" --backend subagents --subagents planner,executor --workers 2
```

## 8) Reliability gate checks

```bash
npm run test:reliability
npm run omg -- verify --suite reliability
```

Optional threshold tuning for reliability troubleshooting:

```bash
npm run omg -- team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
```

## 9) Optional live OMX Team e2e (operator path)

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
