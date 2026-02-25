# Acceptance Gates and Test Matrix

This matrix defines the minimum proof required for each roadmap gate.

## Gate 1A — Install + Sandbox + Verify

### Required commands

```bash
scripts/smoke-install.sh
npm run setup:subagents
scripts/sandbox-smoke.sh --dry-run
npm run verify
```

### Pass criteria

- setup runs twice safely for the same scope
- subagents catalog bootstrap script is idempotent
- sandbox smoke wiring command succeeds (`--dry-run`)
- verify exits with code `0`

### Fail criteria

- second setup run introduces unintended drift
- sandbox execution fails
- verify exits non-zero

## Gate 1B — Minimal Orchestration

### Required commands

```bash
scripts/integration-team-run.sh "smoke"
npm run verify
```

### Pass criteria

- `npm run omg -- team run` exits `0`
- lifecycle artifacts recorded under `.omg/state`
- verify confirms expected workflow behavior

## Gate 2 — Reliability Hardening

### Required commands

```bash
npm run test:reliability
npm run test:all
npm run omg -- verify --suite smoke,integration,reliability
```

### Pass criteria

- health monitor deterministically flags:
  - dead workers,
  - non-reporting workers (missing or stale heartbeat),
  - watchdog failures (stale/invalid snapshot timestamps),
- orchestrator enforces fix-loop cap and records a deterministic `failed` phase,
- persisted worker heartbeat/status signals are merged into monitor snapshots,
- monitor/runtime failure paths surface actionable `failed` reasons.

### Fail criteria

- reliability suite passes only via scaffolding/skipped assertions,
- dead/non-reporting/watchdog failure paths are not exercised in tests,
- failed runs do not persist actionable failure reason/state.

## Optional Operator E2E — Live OMX Team

### Command

```bash
npm run team:e2e -- "oh-my-gemini live team smoke"
```

### Pass criteria

- captures `Team started: <name>` startup evidence,
- reaches terminal task state (`pending=0`, `in_progress=0`, `failed=0`) or
  executes graceful timeout shutdown path,
- verifies cleanup of `.omx/state/team/<name>`.
