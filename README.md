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

## Default Models (Gemini 3)

All tier-routed model defaults now target the **Gemini 3** family:

| Tier | Model ID | Context Window | Max Output |
|------|----------|----------------|------------|
| HIGH | `gemini-3-pro` | 2 M tokens | 65 536 |
| MEDIUM | `gemini-3-flash` | 2 M tokens | 65 536 |
| LOW | `gemini-3-flash-lite` | 1 M tokens | 16 384 |

Override any tier with environment variables:

```bash
export OMG_MODEL_HIGH="gemini-2.5-pro"      # override HIGH tier
export OMG_MODEL_MEDIUM="gemini-2.5-flash"   # override MEDIUM tier
export OMG_MODEL_LOW="gemini-2.5-flash-lite" # override LOW tier
```

Both `google-ai` and `vertex-ai` providers share the same defaults.
Gemini 2.5 models remain available for backward compatibility.

---

## Reliability Features

- **Retry with Exponential Backoff**: API requests automatically retry on transient failures
  (HTTP 429 rate-limit and 5xx server errors). Retries use exponential backoff with jitter,
  capped at a configurable maximum delay. The `Retry-After` header is respected when present.

  ```bash
  # Defaults: 3 retries, 1 s initial delay, 30 s max delay
  # No env config needed — override via GeminiApiClient options if required
  ```

- **Model-Aware Request Timeouts**: request timeouts adapt to the model being called.
  Standard models default to 30 s; thinking models (`*-thinking`, `*-think`) default to 120 s.
  Explicit timeouts take precedence over the model-aware default.

  ```bash
  # Override timeout for all models (milliseconds):
  export OMG_REQUEST_TIMEOUT_MS=60000
  # or
  export GEMINI_REQUEST_TIMEOUT_MS=60000
  ```

- **File-Locked State Writes**: all filesystem state operations (phase state, heartbeats,
  task records, NDJSON audit logs) are protected by advisory file locks using
  `O_CREAT|O_EXCL` atomic creation. Stale locks (>30 s, held by dead PIDs) are
  automatically reaped.

- **Tmux Worker Session Recovery**: crashed worker panes are automatically restarted
  (up to 3 attempts per worker). After 3 failures a worker is marked permanently failed
  and the orchestrator continues with remaining workers.

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

## CI Gates

- **OpenClaw E2E Smoke (required)**: runs `node --import tsx scripts/openclaw-e2e-smoke.ts`
  to ensure OpenClaw command gateways emit `session-start`/`session-end` markers into
  `/tmp/omx-openclaw-agent.jsonl` and that shell-escaped variables block injection attempts.

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

It writes a timestamped report to `.omg/reports/feature-readiness-*.md`.
See also: [`docs/testing/feature-readiness.md`](docs/testing/feature-readiness.md)
