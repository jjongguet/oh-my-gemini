# oh-my-gemini

![oh-my-gemini logo](https://raw.githubusercontent.com/jjongguet/oh-my-gemini/main/docs/assets/omg_logo.png)

Extension-first orchestration layer for Gemini CLI workflows.

**Current npm release:** `0.2.0`

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

## Real-world usage scenarios

### Multi-worker code review with `omg team run`

When a change touches several runtime surfaces, start with a dry-run and then launch a parallel review task:

```bash
npm run omg -- team run \
  --task "review src/team, src/cli, and tests for correctness, reliability, and missing coverage" \
  --workers 4 \
  --dry-run \
  --json

npm run omg -- team run \
  --task "review src/team, src/cli, and tests for correctness, reliability, and missing coverage" \
  --workers 4

npm run omg -- team status --team oh-my-gemini --json
```

See also: [`docs/examples/code-review-workflow.md`](docs/examples/code-review-workflow.md)

### Using the HUD to monitor long-running tasks

Once a run is active, keep the focused HUD open in another terminal so you can see task progress without digging through state files:

```bash
oh-my-gemini hud --team oh-my-gemini --preset focused
oh-my-gemini hud --watch --interval-ms 1000
oh-my-gemini team status --team oh-my-gemini --json
```

This is especially useful while `team run`, `team resume`, or long verification passes are still writing state.

### Setting up custom skills for project-specific workflows

Inside a repository checkout, you can add a project-local skill under `src/skills/` and inspect or load it immediately through the repo-local CLI:

```bash
mkdir -p src/skills/release-check
cat > src/skills/release-check/SKILL.md <<'SKILL'
---
name: release-check
aliases: ["release prep"]
primaryRole: writer
description: Prepare a release checklist for this repository.
---

# Release Check

1. Confirm `npm run typecheck`
2. Confirm `npm run test`
3. Confirm `npm run verify`
4. Summarize blockers and next commands.

Task: {{ARGUMENTS}}
SKILL

npm run omg -- skill list
npm run omg -- skill release-check "prepare the next release candidate"
```

`omg skill <name>` prints the resolved skill prompt so you can use it in your workflow; it does not execute the listed commands automatically.

If you also want the skill exposed through the Gemini extension, mirror it under `extensions/oh-my-gemini/skills/` and relink the extension. See [`docs/examples/custom-skill-guide.md`](docs/examples/custom-skill-guide.md).

## Release highlights (v0.2.0)

- closes the remaining `todo.md` parity gaps landed in PR #42
- adds deterministic worker CLI selection for tmux workers, including Gemini prompt-mode worker support
- ships canonical `configure-notifications` skill surfaces in source + extension catalogs
- hardens skill hygiene (`deprecated` / `mergedInto` / `aliasOf` / non-installable skip)
- improves worker-context compaction and HUD rate-limit tolerance

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
- **Worker CLI Selection**: tmux worker launches honor `OMG_TEAM_WORKER_CLI` and `OMG_TEAM_WORKER_CLI_MAP` so runs can mix default OMG workers with Gemini prompt-mode workers on a per-worker basis.
- **Notification Skill Shipping**: `configure-notifications` is shipped in both source and extension skill catalogs so notification setup is discoverable through `omg skill list`.
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

It writes a timestamped report to `.omx/reports/feature-readiness-*.md`.
See also: [`docs/testing/feature-readiness.md`](docs/testing/feature-readiness.md)
