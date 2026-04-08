# Acceptance Gates and Test Matrix

This matrix defines the minimum proof required for each roadmap gate.

## CI blocking gate matrix (C0/C1/C2/C7)

### C0 — Global install contract (blocking)

Required command:

```bash
npm run gate:global-install-contract
```

Pass criteria:

- Canonical gate composition passes:
  - `scripts/consumer-contract-smoke.sh` (local `.bin` + extension asset + deterministic invocation checks),
  - `scripts/global-install-contract-smoke.sh` (global-prefix alias provenance + setup contract checks),
- both entrypoints are proven in global context:
  - `omp setup --scope project --json`
  - `oh-my-product setup --scope project --dry-run --json`.

Fail criteria:

- installed bin execution fails,
- extension assets are missing from the tarball,
- global alias provenance/setup contract checks fail,
- `npx` invocation without `--no-install` for `omp` is detected in checked scripts/docs/prompts/tests/CI.

### C1 — Quality baseline (blocking)

Required commands:

```bash
npm run gate:legacy-bypass
npm run typecheck
npm run build
npm run test:smoke
npm run test:integration
npm run test:reliability
npm run test:verification
npm run verify -- --tier thorough --json
npm run verify -- --tier light --dry-run --json
```

Pass criteria:

- all quality checks pass with hard-fail semantics (no hidden `continue-on-error`).
- legacy compatibility bypass flags remain disabled (`OMP_LEGACY_RUNNING_SUCCESS!=1`, `OMP_LEGACY_VERIFY_GATE_PASS!=1`).
- verification framework contracts pass (`test runners`, `tier selector`, `assertion helpers`).

Fail criteria:

- `npm run gate:legacy-bypass` exits non-zero because a legacy bypass flag is enabled.

### C2 — Publish gate (blocking for release)

Required command:

```bash
npm run gate:publish
```

Pass criteria:

- publish flow is gated by C0 + C1 equivalent checks (`gate:publish`),
- `.github/workflows/release.yml` publish job triggers via `workflow_run` after CI succeeds (the previous `pre_release_blocking` job was removed in v0.5.7).

### C7 — Legacy bypass governance (blocking in CI/release)

Required command:

```bash
npm run gate:legacy-bypass
```

Pass criteria:

- blocking workflows (`.github/workflows/ci.yml`, `.github/workflows/release.yml`) execute the policy gate before quality/release checks.
- no blocking job relies on `OMP_LEGACY_RUNNING_SUCCESS=1` or `OMP_LEGACY_VERIFY_GATE_PASS=1`.

Fail criteria:

- either legacy bypass flag is enabled in a blocking gate context,
- workflow wiring skips the policy gate in blocking paths.

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
- tier bundles can scope execution: `light` (`typecheck,smoke`), `standard` (`typecheck,smoke,integration`), `thorough` (default full bundle).
- `npm run omp -- verify --dry-run` is plan-only output; skipped suites are not treated as executed pass.
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

- `npm run omp -- team run` exits `0`
- `team run` enforces worker-count contract (`--workers 1..8`, default `3`)
- successful runs persist canonical terminal phase `completed` (legacy `complete` normalized on read)
- lifecycle artifacts recorded under `.omp/state`
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
- runtime snapshots expose `verifyBaselinePassed`; absent/false verify gate signals fail deterministically unless explicit legacy compatibility flags are enabled (`OMP_LEGACY_VERIFY_GATE_PASS`, `OMP_LEGACY_RUNNING_SUCCESS`),
- state store writes canonical task/mailbox artifacts (`tasks/task-<id>.json`, `mailbox/<worker>.ndjson`) with compatibility reads for legacy payloads,
- monitor/runtime failure paths surface actionable `failed` reasons.

### Fail criteria

- reliability suite passes only via scaffolding/skipped assertions,
- dead/non-reporting/watchdog failure paths are not exercised in tests,
- failed runs do not persist actionable failure reason/state.

## Gate 3 — Release readiness (operator + publish)

### Required commands

```bash
npm run gate:publish
npm run team:e2e -- "oh-my-product release gate live evidence"
```

### Optional feature-wise command

```bash
npm run verify:features
npm run verify:features -- --feature team
npm run verify:features -- --dry-run
```

Reference: [`docs/testing/feature-readiness.md`](feature-readiness.md)

### Pass criteria

- Documentation/command/code surfaces stay aligned (no README/gate/CLI contract drift),
- `gate:publish` passes (`gate:global-install-contract` + `gate:3`),
- live omp team evidence (`start -> status polling -> shutdown`) is captured.
- when `verify:features` is used, capability-group checks generate a report under
  `.omp/reports/feature-readiness-*.md`.

### Fail criteria

- docs and CLI contracts conflict,
- consumer contract checks fail (or deterministic invocation policy is violated),
- reliability or verify suites fail,
- operator live e2e evidence is missing.

## Optional Operator E2E — Live OMP Team (ad-hoc)

### Command

```bash
npm run team:e2e -- "oh-my-product live team smoke"
```

### Pass criteria

- captures `Team started: <name>` startup evidence,
- reaches terminal task state (`pending=0`, `in_progress=0`, `failed=0`) or
  executes graceful timeout shutdown path,
- verifies cleanup of `.omp/state/team/<name>`.
