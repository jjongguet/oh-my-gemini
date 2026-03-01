# oh-my-gemini

Extension-first orchestration layer for Gemini CLI workflows.

`oh-my-gemini` provides a TypeScript CLI (`omg`) plus a Gemini extension
surface for setup, diagnostics, team orchestration, and verification.

## Why this project exists

This project takes a compatibility-first approach inspired by:

- [`oh-my-codex`](https://github.com/Yeachan-Heo/oh-my-codex)
- [`oh-my-claudecode`](https://github.com/Yeachan-Heo/oh-my-claudecode)

Core product policy:

- **Extension-first UX**
  (`extensions/oh-my-gemini` is the canonical entry point)
- **tmux as default runtime backend**
- **subagents backend as experimental opt-in**
- **deterministic state and reliability-oriented orchestration checks**

## Current scope (MVP + hardening)

Implemented command surface:

- `omg setup`
- `omg doctor`
- `omg team run`
- `omg verify`

Implemented runtime/system behavior:

- setup/doctor with idempotent managed files and safe auto-fix flow
  (`doctor --fix`)
- team lifecycle orchestration
  (`plan -> exec -> verify -> fix -> completed|failed`)
- worker-count and fix-loop contracts (`workers: 1..8`, `max-fix-loop: 0..3`)
- reliability checks for dead workers, non-reporting workers, and
  watchdog thresholds
- deterministic state artifacts under `.omg/state/team/<team>/`

## Requirements

- Node.js `>=20.10.0`
- npm
- Gemini CLI (`@google/gemini-cli`)
- tmux
- Docker or Podman (for sandbox/runtime checks)

Quick checks:

```bash
node -v
npm -v
gemini --version
tmux -V
docker --version
# optional if using podman
podman --version
```

## Quickstart

```bash
# 1) install dependencies
npm install

# 2) build CLI (optional for local tsx runtime, required for dist/bin)
npm run build

# 3) link extension (canonical control plane)
gemini extensions link ./extensions/oh-my-gemini

# 4) setup + diagnostics
npm run setup
npm run setup:subagents          # optional unless using subagents backend
npm run doctor
npm run omg -- doctor --fix --json
npm run doctor                   # confirm healthy baseline

# 5) verify test harness
npm run verify
npm run omg -- verify --dry-run --json

# 6) run orchestration smoke
npm run omg -- team run --task "smoke" --workers 3
```

Optional helper scripts:

```bash
scripts/bootstrap-dev.sh
scripts/sandbox-smoke.sh
scripts/sandbox-smoke.sh --dry-run
scripts/integration-team-run.sh "smoke"
bash scripts/docker-ci-smoke.sh
npm run team:e2e -- "oh-my-gemini live team smoke"
```

## CLI reference

### `omg setup`

```bash
omg setup [--scope <project|user>] [--dry-run] [--json]
```

- Persists/resolves setup scope with precedence:
  `--scope` > `.omg/setup-scope.json` > `project`
- Provisions managed setup artifacts (including `.gemini/agents/catalog.json`)

### `omg doctor`

```bash
omg doctor [--json] [--strict|--no-strict] [--fix]
```

Checks include:

- node/npm/gemini/tmux availability
- container runtime health (docker or podman)
- setup scope validity
- extension integrity (`extensions/oh-my-gemini/*`)
- `.omg/state` writeability

`--fix` applies safe remediations for supported checks and re-runs diagnostics.

### `omg team run`

```bash
omg team run --task "<description>" \
  [--team <name>] \
  [--backend tmux|subagents] \
  [--workers <1..8>] \
  [--subagents <ids>] \
  [--max-fix-loop <0..3>] \
  [--watchdog-ms <n>] \
  [--non-reporting-ms <n>] \
  [--dry-run] [--json]
```

Behavior highlights:

- Default backend: `tmux`
- Backend auto-switches to `subagents` when task starts with role tags or
  `--subagents` is provided
- Keyword role tags supported at task prefix
  (example: `--task "$planner /executor implement setup flow"`)
- If explicit subagents are provided, assignment count must match resolved
  worker count

### `omg verify`

```bash
omg verify [--suite smoke,integration,reliability] [--dry-run] [--json]
```

Default suites:

- `smoke`
- `integration`
- `reliability`

`--dry-run` is plan-only output (suites are marked skipped, not executed pass).

## NPM scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Build `dist/` CLI output |
| `npm run typecheck` | Strict TS check (`tsc --noEmit`) |
| `npm run test` | Run Vitest suite |
| `npm run test:smoke` | Smoke tests |
| `npm run test:integration` | Integration tests |
| `npm run test:reliability` | Reliability tests |
| `npm run test:all` | smoke + integration + reliability |
| `npm run test:docker` | Clean-room Docker validation (install/setup/tests/verify/team-run) |
| `npm run verify` | `omg verify` wrapper |
| `npm run gate:3` | typecheck + test:all + verify |
| `npm run team:e2e -- "..."` | Live OMX Team operator-path evidence |

## Project layout

```text
src/
  cli/         # command parsing and execution
  installer/   # setup flow and managed artifact updates
  team/        # orchestrator + runtime backends + monitor
  state/       # deterministic JSON/NDJSON persistence helpers

extensions/oh-my-gemini/  # canonical extension context and prompts
scripts/                  # bootstrap/smoke/integration/live-e2e helpers
tests/                    # smoke/integration/reliability suites
docs/                     # architecture/setup/testing contracts
```

## State and observability

Team state is persisted under:

```text
.omg/state/team/<team>/
```

Key artifacts:

- `phase.json`
- `monitor-snapshot.json`
- `tasks/task-<id>.json`
- `mailbox/<worker>.ndjson`
- `workers/worker-<n>/{identity,status,heartbeat,done}.json`

Reference docs:

- `docs/architecture/state-schema.md`
- `docs/architecture/runtime-backend.md`

## Verification & release gates

Recommended baseline for changes:

```bash
npm run typecheck
npm run test
npm run verify
```

Release readiness flow:

```bash
npm run gate:3
npm run team:e2e -- "oh-my-gemini release gate live evidence"
```

Gate details:

- `docs/testing/gates.md`
- `docs/testing/live-team-e2e.md`

## Notes for contributors

- Keep ESM/NodeNext compatibility (`"type": "module"`)
- Treat `extensions/oh-my-gemini/` as canonical public UX
- Avoid direct edits to generated/runtime artifacts unless task-specific
  (`dist/`, `.omg/`, `.omx/`)
