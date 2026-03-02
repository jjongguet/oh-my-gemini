# Canonical 04 — OmG-native Phased Execution Plan (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Canonical Phase Model (Resolved)

The authoritative execution model is **6 phases (0–5)**.

| Phase | Goal | Primary outputs | Blocking gate to exit |
|---|---|---|---|
| 0 | Design lock | contracts, transition matrix, role artifact schema | architecture + policy sign-off |
| 1 | Control-plane foundation | claim/transition/release APIs + lifecycle tests | lifecycle mutation gate |
| 2 | Lifecycle CLI parity | `status/resume/shutdown` + docs/help updates | lifecycle CLI gate |
| 3 | Worker/runtime hardening | protocol enforcement + truthfulness semantics | worker/runtime reliability gate |
| 4 | Role/skill execution expansion | v1 role artifacts + minimal skill mapping | role contract gate |
| 5 | Hardening + rollout | docs/CI finalization + canary/beta/GA readiness | full gate bundle (C0/C1/C2 + R1–R4) |

## 2) Phase Details

## Phase 0 — Design lock

MUST finalize:

- lifecycle API contract,
- transition legality matrix,
- canonical role artifact schema,
- compatibility constraints.

## Phase 1 — Control-plane foundation

MUST deliver:

- `claimTask`, `transitionTaskStatus`, `releaseTaskClaim`,
- deterministic conflict/lease/CAS failure semantics,
- lifecycle mutation tests.

## Phase 2 — Lifecycle CLI parity

MUST deliver:

- `omg team status`, `omg team resume`, `omg team shutdown`,
- stable JSON and exit-code behavior,
- docs/help/extension command sync.

## Phase 3 — Worker/runtime hardening

MUST deliver:

- enforced ACK→claim→execute→result→idle protocol,
- tmux protocol wiring to control-plane,
- subagents truthfulness progression (no unconditional green completion).

## Phase 4 — Role/skill execution expansion

MUST deliver:

- planner/executor/verifier artifact contract enforcement,
- minimal role-skill mapping,
- verifier-driven completion influence.

## Phase 5 — Hardening + rollout

MUST deliver:

- release-grade gate integration,
- legacy bypass governance enforcement,
- canary/beta/GA playbook with rollback criteria.

## 3) Dependency Rules

1. No lifecycle commands before phase 1 APIs stabilize.
2. No role-skill expansion before worker/runtime hardening starts.
3. No default-on rollout before phase 5 evidence bundle is green.

## 4) Required Verification Baseline per Phase

Minimum command evidence for each implementation PR:

- `npm run typecheck`
- `npm run test:reliability`
- `npm run test:integration` (if CLI/runtime touched)
- `npm run verify`

## 5) Program-Level Done Definition

Program is done only when all are true:

- lifecycle control-plane integrity is enforced,
- lifecycle CLI contracts are stable,
- role artifacts are contract-valid,
- truthfulness gates prevent false-green completion,
- rollout and rollback operations are documented and tested.
