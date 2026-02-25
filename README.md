# oh-my-gemini

Extension-first orchestration layer to use Gemini CLI more effectively, inspired by:

- [`oh-my-codex`](https://github.com/Yeachan-Heo/oh-my-codex)
- [`oh-my-claudecode`](https://github.com/Yeachan-Heo/oh-my-claudecode)

This repository currently ships an MVP foundation with:

- setup/doctor/verify CLI commands,
- tmux-default team runtime orchestration (`plan -> exec -> verify`),
- experimental subagents backend scaffold (opt-in),
- sandbox baseline files and smoke scripts,
- smoke/integration/reliability test harness scaffolding.

---

## Requirements

- Node.js 20+
- pnpm
- Gemini CLI (`@google/gemini-cli`)
- tmux
- Docker or Podman (for sandbox runtime checks)

---

## Quickstart

```bash
pnpm install
pnpm build

# Canonical surface: Gemini extension
gemini extensions link ./extensions/oh-my-gemini

# Setup + diagnostics
pnpm omg setup --scope project
pnpm omg doctor

# Verify harness
pnpm omg verify
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
pnpm omg setup --scope project
pnpm omg doctor
pnpm omg team run --task "smoke"
pnpm omg verify --suite smoke,integration

# Reliability-specific checks
pnpm omg team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
pnpm omg verify --suite reliability
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
