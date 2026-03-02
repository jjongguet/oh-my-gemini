# OmG-native Canonical C5 — Phased Execution and Ralplan Dependency Graph

Date: 2026-03-02  
Status: Authoritative

---

## 1) Fixed phase model (locked)

| Phase | Objective | Exit condition |
|---|---|---|
| 0 | Decision lock | Contracts/invariants frozen with no unresolved ambiguity |
| 1 | Control-plane foundation | claim/transition/release + mailbox lifecycle semantics test-passing |
| 2 | Lifecycle CLI parity | `team status/resume/shutdown` integrated and contract-tested |
| 3 | Worker protocol hardening | ACK/claim/result/idle enforcement + deterministic diagnostics |
| 4 | Role/skill contract realization | role schema v1 + skill mapping + artifact validation |
| 5 | Gate hardening + rollout readiness | C3..C7 enabled and rollout criteria satisfied |

---

## 2) Dependency rules

1. Phase 2 cannot start before Phase 1 lifecycle invariants are green.
2. Phase 4 cannot ship default paths before Phase 3 protocol gates pass.
3. Phase 5 cannot declare GA readiness before C3..C7 are blocking and green.
4. Shared contract changes must be merged before worker-parallel implementation tasks.

---

## 3) Ralplan-ready task graph (canonical)

| Task ID | Subject | Depends on | Primary output | Verification minimum |
|---|---|---|---|---|
| RP-W6-00 | Freeze canonical contracts (C2/C3/C4) | - | frozen invariants + transition matrix | review signoff |
| RP-W6-01 | Add control-plane scaffold | RP-W6-00 | `src/team/control-plane/*` interfaces | `npm run typecheck` |
| RP-W6-02 | Implement claim/transition/release APIs | RP-W6-01 | lifecycle-safe mutation APIs | `npm run test:reliability` |
| RP-W6-03 | Implement mailbox lifecycle helpers | RP-W6-01 | send/list/notified/delivered semantics | reliability mailbox tests |
| RP-W6-04 | Add `omg team status` | RP-W6-02 | status command + JSON/text output | integration tests |
| RP-W6-05 | Add `omg team shutdown` | RP-W6-02 | graceful/force shutdown behavior | integration + live smoke |
| RP-W6-06 | Add `omg team resume` | RP-W6-02, RP-W6-05 | resumable run flow | integration + failure-path tests |
| RP-W6-07 | Enforce worker protocol sequence | RP-W6-02 | ACK/claim/evidence/idle checks | reliability protocol tests |
| RP-W6-08 | Define role schema v1 | RP-W6-00 | planner/executor/verifier schema | schema tests |
| RP-W6-09 | Wire role artifact validators | RP-W6-08 | orchestrator verify coupling | integration tests |
| RP-W6-10 | Expand extension skill mapping | RP-W6-08 | plan/team/review/verify/handoff mapping | docs/prompt contract checks |
| RP-W6-11 | Harden subagent evidence model | RP-W6-09 | staged runtime evidence semantics | reliability + integration |
| RP-W6-12 | Activate C3..C7 gates | RP-W6-04, RP-W6-09, RP-W6-11 | CI/release gate updates | `npm run verify` + CI dry-run |
| RP-W6-13 | Finalize rollout + rollback playbook | RP-W6-12 | ring checklist + rollback guide | maintainer rehearsal evidence |

---

## 4) Suggested execution waves

- **Wave A:** RP-W6-00..03
- **Wave B:** RP-W6-04..07
- **Wave C:** RP-W6-08..11
- **Wave D:** RP-W6-12..13

---

## 5) Phase completion checklist

A phase is complete only when all apply:

1. implementation landed,
2. tests/gates passing for that phase,
3. docs/help/prompts updated for changed behavior,
4. dependency risks for next phase explicitly cleared.
