# oh-my-gemini

Extension-first orchestration layer to use Gemini CLI more effectively, inspired by:

- [`oh-my-codex`](https://github.com/Yeachan-Heo/oh-my-codex)
- [`oh-my-claudecode`](https://github.com/Yeachan-Heo/oh-my-claudecode)

## Upstream Reference Baseline (Pinned)

For compatibility-first implementation, this project currently pins the upstream reference versions below (verified on **2026-02-28**):

- `oh-my-codex`: `0.7.5`  
  Source: `main/package.json`  
  https://raw.githubusercontent.com/Yeachan-Heo/oh-my-codex/main/package.json
- `oh-my-claudecode`: `4.5.1`  
  Source: `main/package.json`  
  https://raw.githubusercontent.com/Yeachan-Heo/oh-my-claudecode/main/package.json

This repository currently ships an MVP foundation with:

- setup/doctor/verify CLI commands (including `doctor --fix` safe remediation),
- tmux-default multi-worker runtime orchestration (`plan -> exec -> verify -> fix -> completed|failed`),
- experimental deterministic subagents backend with explicit role assignment (opt-in),
- sandbox baseline files and smoke scripts,
- smoke/integration/reliability test harness scaffolding.

---

## Requirements

- Node.js 20+
- npm
- Gemini CLI (`@google/gemini-cli`)
- tmux
- Docker or Podman (for sandbox runtime checks)

---

## Quickstart

```bash
npm install
npm run build

# Canonical surface: Gemini extension
gemini extensions link ./extensions/oh-my-gemini

# Setup + diagnostics
npm run setup
# optional: only when you plan to use subagents backend
npm run setup:subagents
npm run doctor
npm run omg -- doctor --fix --json
# rerun doctor after --fix to confirm healthy baseline
npm run doctor

# Verify harness
npm run verify
# (defaults to smoke + integration + reliability)
# dry-run is plan-only (skipped suites are not treated as executed pass)
npm run omg -- verify --dry-run --json
# note: live operator evidence is collected separately via `npm run team:e2e -- "..."`
```

Optional live sandbox smoke:

```bash
bash scripts/sandbox-smoke.sh
```

Safe scaffold-only smoke (no live Gemini call):

```bash
bash scripts/sandbox-smoke.sh --dry-run
```

---

## CLI Commands

```bash
npm run setup
npm run doctor
npm run omg -- doctor --fix --json
npm run omg -- team run --task "smoke" --workers 3
# (--workers supports 1..8, default is 3)
# (explicit subagent assignments must match resolved worker count)
npm run omg -- verify
npm run gate:3
# for release evidence, run live e2e after gate:3 is green
npm run team:e2e -- "oh-my-gemini release gate live evidence"

# Reliability-specific checks
npm run omg -- team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
npm run omg -- verify --suite reliability

# Subagents backend (explicit assignment + unified model catalog)
npm run omg -- team run --task "phase-c subagents smoke" --backend subagents --subagents planner,executor --workers 2 --json

# Keyword assignment shortcut (auto-selects subagents backend)
npm run omg -- team run --task '$planner /executor implement setup flow' --json

# Live OMX Team e2e cycle (start -> status polling -> shutdown)
npm run team:e2e -- "oh-my-gemini live team smoke"
```

---

## Project Layout

```text
src/
  cli/         # omg command surface
  installer/   # setup, scope persistence, marker merge
  team/        # orchestrator + runtime backends
  state/       # state persistence helpers

extensions/oh-my-gemini/  # Gemini extension surface (canonical UX)
scripts/                  # smoke/integration/bootstrap helpers
tests/                    # smoke/integration/reliability suites
docs/                     # setup, architecture, gate docs
```

---

## Implementation Status (Roadmap Snapshot)

- ✅ Gate 0: decision lock (extension-first, tmux default, subagents opt-in, scope precedence)
- ✅ Gate 1A (MVP): setup/doctor/verify harness + idempotency
- ✅ Gate 1B (MVP): minimal orchestration lifecycle
- 🟡 Gate 2+: reliability hardening in progress (dead/non-reporting/watchdog handling + deterministic failure-path tests)

See:

- `./.omx/plans/oh-my-gemini-phased-roadmap.md`
- `./docs/testing/gates.md`
- `./docs/architecture/state-schema.md`
