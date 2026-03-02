# C5 — Unified Phased Delivery Plan (P0..P5)

## 1) Canonical phase model

This plan replaces all prior 5/6/7-phase variants with one normalized sequence.

| Phase | Goal | Exit criteria |
|---|---|---|
| P0 | Design lock + contract freeze | C1/C2/C3/C4 accepted; unresolved architecture contradictions = 0 |
| P1 | Control-plane foundation | claim/transition/release APIs implemented + deterministic tests passing |
| P2 | Lifecycle CLI parity | `team status/resume/shutdown` implemented + integration-tested |
| P3 | Worker protocol/runtime enforcement | tmux protocol hardening + restart/resume truthfulness proven |
| P4 | Role/skill contract operationalization | planner/executor/verifier evidence schema enforced in workflows |
| P5 | Hardening + rollout readiness | gates blocking policy active; ring promotion criteria satisfied |

## 2) Detailed execution plan

### P0 — Design lock
- Deliverables: canonical docs C1..C4 finalized, invariants frozen.
- Depends on: none.
- Evidence: doc approval + contradiction log closed.

### P1 — Control-plane foundation
- Deliverables:
  - control-plane module added,
  - API contracts wired,
  - deterministic error taxonomy implemented.
- Depends on: P0.
- Evidence: reliability tests for claim conflict, lease expiry, invalid transitions.

### P2 — Lifecycle CLI parity
- Deliverables:
  - CLI commands for status/resume/shutdown,
  - extension command parity updates,
  - operator status summary path.
- Depends on: P1.
- Evidence: command contract tests + help/docs parity checks.

### P3 — Worker/runtime enforcement
- Deliverables:
  - ACK->claim->execute->result->idle enforced in tmux path,
  - resume semantics validated under interruption,
  - monitor/status consistency guarantees.
- Depends on: P1, P2.
- Evidence: integration/e2e worker protocol tests.

### P4 — Role/skill contract
- Deliverables:
  - minimum role band formalized,
  - skill output schema validation,
  - verifier evidence pipeline enabled.
- Depends on: P2, P3.
- Evidence: schema validation tests + sample multi-role run evidence.

### P5 — Hardening + rollout readiness
- Deliverables:
  - CI/release blocking gates active,
  - migration flags governance complete,
  - rollout runbook + rollback playbook complete.
- Depends on: P1..P4.
- Evidence: release simulation + gate matrix green.

## 3) Parallelization policy

Safe parallel tracks after P0:
- Track A: control-plane internals (P1)
- Track B: CLI/extension surface (P2)
- Track C: docs/gates instrumentation (P5 prep)

Unsafe parallelization:
- runtime protocol enforcement before claim/transition semantics stabilize,
- gate hard-blocking before command contracts are deterministic.

## 4) Completion rule

Program execution is done only when **all P0..P5 exits are met** and C6 blocking gates are green at target rollout ring.

