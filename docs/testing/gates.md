# Acceptance Gates and Test Matrix

This matrix defines the minimum proof required for each roadmap gate.

## Gate 1A — Install + Sandbox + Verify

### Required commands

```bash
scripts/smoke-install.sh
npm run setup
npm run doctor
scripts/sandbox-smoke.sh --dry-run
npm run verify
```

### Conditional command (when using subagents backend)

```bash
npm run setup:subagents
```

### Pass criteria

- setup runs twice safely for the same scope
- doctor reports actionable diagnostics and exits `0` on healthy baseline
- subagents catalog bootstrap script is idempotent (when subagents backend is enabled)
- sandbox smoke wiring command succeeds (`--dry-run`)
- default `verify` suite set is `typecheck,smoke,integration,reliability`
- verify exits with code `0`

### Fail criteria

- second setup run introduces unintended drift
- sandbox execution fails
- verify exits non-zero

### Notes

- `npm run verify` runs deterministic suites (`typecheck`, `smoke`, `integration`, `reliability`) by default.
- `npm run omg -- verify --dry-run` is plan-only output; skipped suites are not treated as executed pass.
- Live Gemini/tmux operator-path evidence is collected separately in Gate 3 via `team:e2e`.
- Optional key-authenticated Docker live smoke:
  `GEMINI_API_KEY=<key> npm run test:docker:full`.

## Gate 1B — Minimal Orchestration

### Required commands

```bash
scripts/integration-team-run.sh "smoke"
npm run verify
```

### Pass criteria

- `npm run omg -- team run` exits `0`
- `team run` enforces worker-count contract (`--workers 1..8`, default `3`)
- successful runs persist canonical terminal phase `completed` (legacy `complete` normalized on read)
- lifecycle artifacts recorded under `.omg/state`
- verify confirms expected workflow behavior

## Gate 2 — Reliability Hardening

### Required commands

```bash
npm run test:reliability
npm run test:all
npm run verify
```

### Pass criteria

- health monitor deterministically flags:
  - dead workers,
  - non-reporting workers (missing or stale heartbeat),
  - watchdog failures (stale/invalid snapshot timestamps),
- orchestrator enforces fix-loop cap (default `3`) and records a deterministic `failed` phase,
- persisted worker heartbeat/status signals are merged into monitor snapshots,
- runtime snapshots expose `verifyBaselinePassed`; absent/false verify gate signals fail deterministically unless explicit legacy compatibility flags are enabled (`OMG_LEGACY_VERIFY_GATE_PASS`, `OMG_LEGACY_RUNNING_SUCCESS`),
- state store writes canonical task/mailbox artifacts (`tasks/task-<id>.json`, `mailbox/<worker>.ndjson`) with compatibility reads for legacy payloads,
- monitor/runtime failure paths surface actionable `failed` reasons.

### Fail criteria

- reliability suite passes only via scaffolding/skipped assertions,
- dead/non-reporting/watchdog failure paths are not exercised in tests,
- failed runs do not persist actionable failure reason/state.

## Gate 3 — Release Readiness

### Required commands

```bash
npm run gate:3
npm run team:e2e -- "oh-my-gemini release gate live evidence"
```

### Pass criteria

- Documentation/command/code surfaces stay aligned (no README/gate/CLI contract drift),
- `gate:3` passes (typecheck + smoke/integration/reliability + verify),
- live OMX team evidence (`start -> status polling -> shutdown`) is captured.

### Fail criteria

- docs and CLI contracts conflict,
- reliability or verify suites fail,
- operator live e2e evidence is missing.

## Optional Operator E2E — Live OMX Team (ad-hoc)

### Command

```bash
npm run team:e2e -- "oh-my-gemini live team smoke"
```

### Pass criteria

- captures `Team started: <name>` startup evidence,
- reaches terminal task state (`pending=0`, `in_progress=0`, `failed=0`) or
  executes graceful timeout shutdown path,
- verifies cleanup of `.omx/state/team/<name>`.
