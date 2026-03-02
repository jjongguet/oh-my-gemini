# C7 — Risk Register, Rollout/Rollback, and ralplan Backlog

## 1) Canonical risk register

| Risk ID | Risk | Impact | Likelihood | Mitigation | Detection signal |
|---|---|---:|---:|---|---|
| R1 | False-green from legacy bypass flags | High | Medium | enforce G7 in release workflows | release gate failure logs |
| R2 | Claim/transition race conditions | High | Medium | deterministic control-plane guards + tests | flaky/non-deterministic lifecycle tests |
| R3 | Resume semantics cause duplicate/orphan work | High | Medium | P3 resume contract + integration tests | state/status divergence after restart |
| R4 | Worker protocol drift across runtimes | High | Medium | centralized protocol contract + shared tests | backend-specific behavior mismatch |
| R5 | Role/skill artifacts become non-uniform | Medium | Medium | schema validation + verifier enforcement | artifact validation failures |
| R6 | Namespace migration breaks startup | Medium | Medium | dual-read migration window + telemetry | startup/env parsing failures |
| R7 | CI duration/flakiness growth | Medium | Medium | isolate deterministic suites, stage expensive e2e | unstable CI runtime/SLA drift |
| R8 | Docs drift from actual CLI behavior | Medium | Medium | docs parity gate (G5) | docs-contract gate failures |
| R9 | Subagents claims exceed deterministic reality | Medium | Medium | keep opt-in and stage behind proven parity | mismatch between promised/observed behavior |
| R10 | Deprecation cleanup removes fallback too early | Medium | Low | ring-based rollout with rollback hooks | user/operator incident spikes |

## 2) Rollout model (Ring 0..3)

### Ring 0 — Internal hardening
- features behind opt-in flags
- P1/P2 stabilization
- no public default change

### Ring 1 — Maintainer canary
- G1/G2 blocking
- lifecycle and control-plane parity must stay green across repeated runs

### Ring 2 — Broad beta/default-ready path
- G1..G5 blocking
- worker protocol + role/skill artifact contract required

### Ring 3 — GA + strict governance
- G1..G7 blocking
- unsafe bypasses prohibited
- migration/deprecation policy enforced

## 3) Rollback policy

Rollback trigger examples:
1. state corruption or unrecoverable lifecycle divergence
2. repeated protocol violations in tmux e2e runs
3. critical release-gate false-green risk

Rollback actions:
- demote rollout ring,
- re-enable audited compatibility mode (if available),
- patch + re-verify full gate matrix before re-promotion.

## 4) ralplan-ready backlog (canonical skeleton)

### Track A — Control-plane foundation
- T01 contracts/types freeze
- T02 claim lock utility
- T03 `claimTask` implementation
- T04 `transitionTaskStatus` implementation
- T05 `releaseTaskClaim` implementation
- T06 deterministic error taxonomy wiring
- T07 reliability suite for lifecycle conflicts

### Track B — Lifecycle CLI parity
- T08 `team status`
- T09 `team resume`
- T10 `team shutdown`
- T11 extension command parity and docs sync

### Track C — Worker/runtime protocol
- T12 worker protocol schema formalization
- T13 tmux enforcement hooks
- T14 resume/restart truthfulness tests
- T15 mailbox delivery/notified semantics hardening

### Track D — Role/skill contract
- T16 minimum role registry enforcement
- T17 skill artifact schema v1
- T18 verifier evidence pipeline
- T19 contract tests for role/skill outputs
- T20 operator-facing runbook updates

### Track E — Gates + rollout readiness
- T21 gate wiring G1/G2
- T22 gate wiring G3/G4/G5
- T23 release hard-block G7
- T24 rollout/rollback automation checks
- T25 deprecation completion checklist + final parity audit

## 5) Go / No-Go rule

Go to next ring only if:
- current ring blocking gates are green,
- no unresolved high-severity risks,
- rollback path remains tested and documented.

