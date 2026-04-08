# OMP-Native Canonical 04 — Phased Execution Plan

Status: **Canonical (authoritative)**  
Date: 2026-03-02

## 1) Fixed phase model (authoritative)

Phase model is fixed to **Phase 0..5**:

| Phase | Objective | Key outputs | Exit criteria |
|---|---|---|---|
| 0 | Decision lock | ADR-level contract freeze (lifecycle, protocol, role schema) | No unresolved contract ambiguity |
| 1 | Control-plane foundation | claim/transition/release + mailbox lifecycle APIs | Deterministic reliability evidence |
| 2 | Lifecycle CLI parity | `team status/resume/shutdown` | Integration tests + docs/help parity |
| 3 | Worker protocol hardening | ACK/claim/evidence/idle enforcement | Protocol violations fail deterministically |
| 4 | Role/skill contract v1 | planner/executor/verifier schema + mapped skills | Artifact validation enforced |
| 5 | Gate hardening + rollout | C3..C7 gate activation, legacy-governance, rollout rings | GA criteria met without bypass flags |

## 2) Dependency and ordering rules

1. No Phase 2 shipping until Phase 1 invariants pass.
2. No Phase 4 default path until Phase 3 protocol gate is stable.
3. No GA movement in Phase 5 until C3..C7 are green in release context.
4. Shared contract changes require explicit dependency ordering across tasks.

## 3) Phase deliverable details

## Phase 0

- Canonical contract docs approved
- Transition matrix approved
- Role artifact schema draft approved

## Phase 1

- Control-plane module implemented
- Claim/transition/release reliability suites landed
- Mailbox lifecycle helper coverage landed

## Phase 2

- Lifecycle command handlers + parser tests
- JSON/text output contract
- Runbooks/docs/extension prompt updates for lifecycle commands

## Phase 3

- Worker startup protocol generator/contract checks
- Runtime enforcement for missing ACK/claim/evidence/idle
- Failure reason taxonomy wired into monitor artifacts

## Phase 4

- Role schema validator + artifact registry
- Skill mappings for `plan`, `team`, `review`, `verify`, `handoff`
- Verify-stage coupling to role evidence completeness

## Phase 5

- C3..C7 CI/release gate activation
- Legacy bypass governance (block/restrict in release)
- Ringed rollout + rollback rehearsals documented

## 4) Program-level done definition

Program is done only when all are true:

1. lifecycle CLI parity is live and stable,
2. control-plane mutation semantics are the sole lifecycle path,
3. worker protocol is enforced in production tmux path,
4. role/skill contracts produce verifiable durable artifacts,
5. release gates block regressions and legacy false-green paths.
