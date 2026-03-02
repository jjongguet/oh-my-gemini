# Canonical 06 — OmG-native Risk Register, Rollout, and Rollback (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Canonical Risk Register

| Risk ID | Risk | Likelihood | Impact | Canonical mitigation |
|---|---|---|---|---|
| R-01 | False-green completion from legacy bypass/synthetic evidence | M | H | block legacy bypass in release gates; enforce evidence contract |
| R-02 | Non-deterministic claim/transition outcomes | M | H | claim-token + lease + deterministic lifecycle tests |
| R-03 | State schema compatibility break | M | H | additive schema policy + compatibility tests + migration notes |
| R-04 | CLI/docs/extension drift | H | M | docs contract gate (R4) + synchronized update checklist |
| R-05 | Role outputs become nominal (not actionable) | M | H | role artifact schema validation + verifier authority |
| R-06 | Subagents claims outrun real runtime behavior | M | M | keep opt-in + truthfulness gate before broader rollout |
| R-07 | tmux stability regressions during integration | L-M | H | isolate runtime transport and add live smoke coverage |
| R-08 | CI duration and flake inflation | M | M | staged blocking strategy + targeted reliability suites |
| R-09 | OmG identity dilution from parity chasing | M | M | enforce adopt/adapt/reject policy from canonical 01/03 |

## 2) Canonical Rollout Rings

## Ring 0 — Internal design freeze

- Contract and gate readiness only.
- No user-facing default changes.

## Ring 1 — Canary (opt-in)

- Internal maintainers only.
- Lifecycle and control-plane deltas enabled in constrained scope.

Exit criteria:

- 7 days without high-severity regression,
- lifecycle/control-plane reliability suite stable,
- docs contract checks green for changed surfaces.

## Ring 2 — Beta

- Wider contributor opt-in.
- Role artifacts active for subagent flows.

Exit criteria:

- two release cycles without corruption/loss incidents,
- stable lifecycle + role integration tests,
- operator runbook validated.

## Ring 3 — GA

- Gates fully blocking.
- Unsafe compatibility bypasses disabled/retired.

Exit criteria:

- C0/C1/C2 + R1/R2/R3/R4 all green,
- no open P0/P1 issues.

## 3) Canonical Rollback Policy

Rollback triggers:

- unrecoverable state corruption,
- repeated non-deterministic task ownership bugs,
- inability to shutdown/resume safely,
- verifier/evidence integrity regression.

Rollback steps:

1. disable new behavior via feature toggle/fallback path,
2. preserve state readability,
3. keep `team run` baseline operable,
4. publish incident summary and add missing guardrails before re-enable.

## 4) Operational Metrics to Track

- lifecycle command success/failure ratio,
- claim conflict/lease expiry rate,
- stale worker/non-reporting rate,
- false-green detection count,
- docs drift incidents,
- release-gate block reasons.
