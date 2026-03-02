# OmG-native Canonical 05 — Phased Execution Plan (Worker 4)

Date: 2026-03-02  
Status: **Canonical**  
Depends on: C1, C2, C3, C4

## 1) Canonical phase model (authoritative)

Program uses exactly six phases:

- **Phase 0**: Decision lock + contract freeze
- **Phase 1**: Control-plane foundation
- **Phase 2**: Lifecycle CLI parity
- **Phase 3**: Worker protocol enforcement
- **Phase 4**: Role/skill parity + subagents truthfulness
- **Phase 5**: Reliability hardening + rollout/deprecation completion

Any other phase taxonomy is non-canonical.

## 2) Phase-by-phase execution

## Phase 0 — Decision lock + contract freeze

Deliverables:

- canonical docs C1..C7 approved,
- ADR set created (see C4),
- deprecation list ratified.

Exit criteria:

- no unresolved contradiction on phase/gate naming,
- canonical precedence accepted by maintainers.

## Phase 1 — Control-plane foundation

Deliverables:

- Team Control Plane module skeleton (`task lifecycle`, `mailbox`, `worker protocol`),
- mutation routing from runtime/orchestrator into control-plane layer,
- transition/claim validation tests.

Exit criteria:

- direct lifecycle overwrite paths removed from new code,
- contention + invalid transition tests pass.

## Phase 2 — Lifecycle CLI parity

Deliverables:

- `omg team status`, `omg team resume`, `omg team shutdown`,
- CLI help/docs updated,
- integration tests for happy/invalid/no-state paths.

Exit criteria:

- operator commands work without OmX fallback,
- command/docs/help parity checks are green.

## Phase 3 — Worker protocol enforcement

Deliverables:

- runtime enforcement for ACK -> claim -> execute -> report -> idle,
- deterministic failure taxonomy for protocol violations,
- monitor/reporting integration for protocol failures.

Exit criteria:

- protocol violations block completion truth,
- reliability tests exercise protocol failure cases.

## Phase 4 — Role/skill parity + subagents truthfulness

Deliverables:

- role contract v1 (`planner`,`executor`,`verifier`),
- role output schema validation + deterministic artifact paths,
- subagents completion checks aligned with tmux evidence requirements.

Exit criteria:

- role evidence is required for completion in relevant flows,
- cross-backend parity tests pass for evidence gating.

## Phase 5 — Reliability hardening + rollout/deprecation completion

Deliverables:

- C0..C7 gate enforcement in CI/release,
- legacy bypass deprecation enforcement,
- rollout ring progression and rollback playbooks validated.

Exit criteria:

- release-bound branches pass without compatibility crutches,
- rollout criteria for Ring 2/3 are met.

## 3) Dependency graph (critical path)

`Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5`

Parallel-safe substreams inside critical path:

- docs and tests can evolve in parallel after phase entry,
- runtime backend parity checks can run parallel once control-plane API is stable.

## 4) Milestone packaging (ralplan-ready)

| Milestone | Included phases | Goal |
|---|---|---|
| M1 | 0-1 | Freeze decisions and land mutation-safe control-plane foundation |
| M2 | 2 | Deliver operator lifecycle command parity |
| M3 | 3 | Enforce worker protocol and failure taxonomy |
| M4 | 4 | Land role/skill contracts and cross-backend truth checks |
| M5 | 5 | Gate hardening, rollout progression, deprecation completion |

## 5) Phase-level done definition

A phase is done only when:

1. required code/docs/tests for that phase are merged,
2. phase-linked gates in C6 are green,
3. risks introduced by phase are reflected in C7,
4. no unresolved contradiction remains against C1..C4.
