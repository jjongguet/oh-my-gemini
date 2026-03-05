# oh-my-gemini

![oh-my-gemini logo](docs/assets/omg_logo.png)

Extension-first orchestration layer for Gemini CLI workflows.

`oh-my-gemini` provides:
- a CLI runtime (`oh-my-gemini`, alias `omg`),
- a Gemini extension package (`extensions/oh-my-gemini`),
- team orchestration with tmux default backend.

---

## Requirements

- Node.js `>=20.10.0`
- Gemini CLI (`@google/gemini-cli`)
- tmux (required for team orchestration)
  - macOS: `brew install tmux`
  - Debian/Ubuntu: `sudo apt install tmux`

Quick check:

```bash
node -v
gemini --version
tmux -V
```

---

## Install

```bash
npm install -g oh-my-gemini-sisyphus
```

After global install, run setup to apply local filesystem artifacts:

```bash
omg setup --scope project
# equivalent
oh-my-gemini setup --scope project
```

---

## Quickstart

```bash
# 1) link packaged extension into Gemini CLI
EXT_PATH="$(oh-my-gemini extension path)"
gemini extensions link "$EXT_PATH"

# optional: inspect/register built-in CLI MCP tools
oh-my-gemini tools list --json
oh-my-gemini tools manifest --json

# 2) initialize + diagnose
oh-my-gemini setup --scope project
oh-my-gemini doctor --fix --json --no-strict

# 3) verify + run smoke task
oh-my-gemini verify
oh-my-gemini team run --task "smoke" --workers 3

# 4) lifecycle operations
oh-my-gemini hud --team oh-my-gemini --preset focused
oh-my-gemini hud --watch --interval-ms 1000
oh-my-gemini team status --team oh-my-gemini --json
oh-my-gemini team resume --team oh-my-gemini --max-fix-loop 1
oh-my-gemini team shutdown --team oh-my-gemini --force --json

# 5) optional MCP stdio surface (tools/resources/prompts)
oh-my-gemini mcp serve --dry-run --json
```

---

## Reliability Features

- **Worker Heartbeat**: each worker emits a keepalive every ~30 seconds while running.
  The orchestrator uses heartbeat freshness to detect dead or stalled workers.
- **Atomic Task Claims**: task ownership is pre-assigned at launch with `OMG_WORKER_TASK_ID` and `OMG_WORKER_CLAIM_TOKEN`.
  Workers execute only their assigned claim, preventing cross-process race conditions.
- **Hook Context Injection**: generated `GEMINI.md` includes the local skill catalog for runtime discovery.
  Workers can find available skills and canonical role-hints without ad-hoc filesystem scans.
- **Skill Runtime Integration**: workers can run `omg skill <name>` to load skill prompts into the current flow.
  This keeps skill usage explicit, reproducible, and consistent across orchestrated sessions.
- **Bundled Skill Catalog**: runtime skill loading now includes source-native prompts for
  `deep-interview`, `review`, `verify`, and `handoff` (with extension fallback for `plan`/`team`).

---

## Detailed references

- `omg` command reference: [`docs/omg/commands.md`](docs/omg/commands.md)
- README/docs boundary: [`docs/omg/docs-boundary.md`](docs/omg/docs-boundary.md)
- Project structure + npm scripts: [`docs/omg/project-map.md`](docs/omg/project-map.md)

---

## Feature-wise readiness check

Run this command to validate open-beta core features by capability group
(team orchestration, hook system, skill/role, setup/doctor, core commands):

```bash
npm run verify:features
npm run verify:features -- --dry-run
npm run verify:features -- --feature team
```

It writes a timestamped report to `.omx/reports/feature-readiness-*.md`.
See also: [`docs/testing/feature-readiness.md`](docs/testing/feature-readiness.md)
