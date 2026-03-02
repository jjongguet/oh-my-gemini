# oh-my-gemini

![oh-my-gemini logo](docs/assets/omg_logo.png)

Extension-first orchestration layer for Gemini CLI workflows.

`oh-my-gemini` provides:
- a CLI runtime (`oh-my-gemini`, alias `omg`),
- a Gemini extension package (`extensions/oh-my-gemini`),
- team orchestration with tmux default backend.

---

## README scope (important)

This README is intentionally focused on **what users need first**:
1. install,
2. quickstart,
3. `omg` command usage.

Deep operational details are moved to `docs/` (see [README vs docs](#readme-vs-docs-boundary)).

---

## Requirements

- Node.js `>=20.10.0`
- npm
- Gemini CLI (`@google/gemini-cli`)
- tmux
- Docker or Podman

Quick check:

```bash
node -v
npm -v
gemini --version
tmux -V
docker --version
# optional
podman --version
```

---

## Install

### 1) End user install (no local build)

```bash
npm install -g oh-my-gemini
```

### 2) Contributor install (repo workflow)

```bash
git clone https://github.com/jjongguet/oh-my-gemini.git
cd oh-my-gemini
npm install
```

---

## Quickstart

### A) End user quickstart (recommended)

```bash
# 1) link packaged extension into Gemini CLI
EXT_PATH="$(oh-my-gemini extension path)"
gemini extensions link "$EXT_PATH"

# 2) initialize + diagnose
oh-my-gemini setup --scope project
oh-my-gemini doctor --fix --json --no-strict

# 3) verify + run smoke task
oh-my-gemini verify
oh-my-gemini team run --task "smoke" --workers 3
```

### B) Contributor quickstart (repo-local)

```bash
# from repository root
npm run setup
npm run doctor
npm run verify
npm run omg -- team run --task "smoke" --workers 3
```

---

## `omg` command quick reference

> `oh-my-gemini` and `omg` are equivalent CLI entry points.

### `omg setup`

```bash
omg setup [--scope <project|user>] [--dry-run] [--json]
```

- Persists setup scope precedence:
  `--scope` > `.omg/setup-scope.json` > default `project`
- Provisions managed setup artifacts (including `.gemini/agents/catalog.json`)

### `omg doctor`

```bash
omg doctor [--json] [--strict|--no-strict] [--fix] [--extension-path <path>]
```

- Checks node/npm/gemini/tmux/container runtime + extension integrity + `.omg/state` writeability
- `--fix` applies safe remediations and reruns diagnostics

### `omg extension path`

```bash
omg extension path [--json] [--extension-path <path>]
```

- Resolves extension root precedence:
  `--extension-path` / `OMG_EXTENSION_PATH` > `./extensions/oh-my-gemini` > installed package assets
- Useful for user install flow:

```bash
EXT_PATH="$(oh-my-gemini extension path)"
gemini extensions link "$EXT_PATH"
```

### `omg team run`

```bash
omg team run --task "<description>" \
  [--backend tmux|subagents] \
  [--workers <1..8>] \
  [--subagents <ids>] \
  [--max-fix-loop <0..3>] \
  [--watchdog-ms <n>] \
  [--non-reporting-ms <n>] \
  [--dry-run] [--json]
```

- Default backend: `tmux`
- Auto-switches to `subagents` when subagent tags/flags are used
- Worker range contract: `1..8`

### `omg verify`

```bash
omg verify [--suite typecheck,smoke,integration,reliability] [--dry-run] [--json]
```

Default suites:
- `typecheck`
- `smoke`
- `integration`
- `reliability`

---

## README vs docs boundary

| Where | What belongs there |
| --- | --- |
| `README.md` | install, fast quickstart, command cheat sheet |
| `docs/setup/quickstart.md` | full onboarding flow, sandbox/docker smoke, detailed step-by-step |
| `docs/testing/gates.md` | CI/release gate definitions (C0/C1/C2, pass/fail criteria) |
| `docs/testing/live-team-e2e.md` | live operator runbook (`omx team`) |
| `docs/architecture/*` | runtime/state contracts and architecture internals |

If you are new, start here (README). If you are operating/debugging/releasing, go to `docs/`.

---

## Project structure (top-level)

| Path | Purpose |
| --- | --- |
| `src/` | TypeScript implementation (`cli`, `installer`, `team`, `state`) |
| `extensions/` | Gemini extension package (`extensions/oh-my-gemini`) |
| `scripts/` | bootstrap/smoke/docker/e2e automation |
| `tests/` | smoke/integration/reliability suites |
| `docs/` | setup, testing, architecture docs |
| `.github/workflows/` | CI + release workflows |

---

## Key npm scripts

| Script | Purpose |
| --- | --- |
| `npm run setup` | setup with project scope |
| `npm run doctor` | diagnostics |
| `npm run verify` | default verify suites |
| `npm run omg -- <args>` | run CLI from source checkout |
| `npm run gate:consumer-contract` | consumer tarball contract gate |
| `npm run gate:publish` | publish gate (`consumer-contract + gate:3`) |

