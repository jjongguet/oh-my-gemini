# oh-my-gemini

Extension-first orchestration layer to use Gemini CLI more effectively, inspired by:

- [`oh-my-codex`](https://github.com/Yeachan-Heo/oh-my-codex)
- [`oh-my-claudecode`](https://github.com/Yeachan-Heo/oh-my-claudecode)

This repository currently ships an MVP foundation with:

- setup/doctor/verify CLI commands,
- tmux-default team runtime orchestration (`plan -> exec -> verify`),
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
npm run setup:subagents
npm run doctor

# Verify harness
npm run verify
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
npm run omg -- team run --task "smoke"
npm run omg -- verify --suite smoke,integration

# Reliability-specific checks
npm run omg -- team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
npm run omg -- verify --suite reliability

# Subagents backend (explicit assignment + unified model catalog)
npm run omg -- team run --task "phase-c subagents smoke" --backend subagents --subagents planner,executor --json

# Keyword assignment shortcut (auto-selects subagents backend)
npm run omg -- team run --task "$planner /executor implement setup flow" --json

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
