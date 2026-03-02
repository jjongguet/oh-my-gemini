# Canonical-7 Manifest + Source Mapping (Worker 7)

Date: 2026-03-02  
Scope: Convert the current 26-document OmG-native adoption output into one authoritative 7-document set for **Team Orchestration + Agent Role/Skill adoption**.

## 1) Authority Rule (single source of truth)

Only the seven docs listed below are authoritative for implementation, review, and release decisions.  
All prior cycle docs are retained only as historical context and are non-canonical.

## 2) Canonical-7 set

| Canonical ID | File | Purpose |
|---|---|---|
| C1 | `docs/analysis/canonical-7-worker-7/01-program-charter-and-decisions.md` | Program charter, scope, and contradiction-resolution decisions |
| C2 | `docs/analysis/canonical-7-worker-7/02-capability-parity-matrix.md` | OmG vs OmX/OmC capability deltas with SHALL-level parity requirements |
| C3 | `docs/analysis/canonical-7-worker-7/03-target-architecture-and-control-plane-contract.md` | Target architecture, state/control-plane APIs, FSM, migration constraints |
| C4 | `docs/analysis/canonical-7-worker-7/04-worker-role-skill-contract.md` | Worker bootstrap protocol + role/skill/evidence contract |
| C5 | `docs/planning/canonical-7-worker-7/05-phased-delivery-plan.md` | Unified phase model and delivery sequencing |
| C6 | `docs/planning/canonical-7-worker-7/06-acceptance-ci-release-gates.md` | Acceptance criteria, CI gates, release-blocking policy |
| C7 | `docs/planning/canonical-7-worker-7/07-risk-rollout-rollback-and-ralplan-backlog.md` | Risk register, rollout/rollback policy, ralplan-ready task backlog |

## 3) Contradictions resolved (explicit)

| Conflict seen in 26-doc set | Canonical decision |
|---|---|
| Lifecycle verbs varied (`start` vs `run`) | Official OmG lifecycle surface: `team run`, `team status`, `team resume`, `team shutdown` |
| Phase models varied (5, 6, 7 phases) | Standardize on **6 phases**: P0..P5 |
| Rollout terms varied (Wave/Stage/Ring) | Standardize on **Ring 0..3** only |
| API naming varied (`transitionTask`, `transitionTaskStatus`) | Canonical APIs: `claimTask`, `transitionTaskStatus`, `releaseTaskClaim` |
| State mutation path ambiguous (API vs direct file write) | New runtime mutations MUST use control-plane APIs; direct writes allowed only for legacy read compatibility tooling |
| Role baseline varied | Mandatory minimum roles: `planner`, `executor`, `verifier`; optional specialized roles are additive |
| Namespace migration guidance varied | Dual-read (`OMX_*` + `OMG_*`) for one release window, then enforce `OMG_*` in release gates |

## 4) 26 -> Canonical mapping matrix

| # | Prior doc | Canonical target(s) | Disposition |
|---:|---|---|---|
| 1 | `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | C1, C5, C7 | Deprecated (merged index/briefing content) |
| 2 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | C1, C2, C3 | Deprecated (superseded synthesis) |
| 3 | `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | C2 | Deprecated (superseded matrix) |
| 4 | `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | C3 | Deprecated (superseded architecture contract) |
| 5 | `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | C1, C2, C4 | Deprecated (superseded synthesis) |
| 6 | `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | C2 | Deprecated (redundant delta matrix) |
| 7 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | C1, C2, C3 | Deprecated (worker variant merged) |
| 8 | `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | C2, C3 | Deprecated (worker variant merged) |
| 9 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | C1, C2 | Deprecated (worker variant merged) |
| 10 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | C2, C3 | Deprecated (worker variant merged) |
| 11 | `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | C5 | Deprecated (phase model consolidated) |
| 12 | `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | C6 | Deprecated (gate model consolidated) |
| 13 | `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | C5 | Deprecated (duplicate phase plan) |
| 14 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | C5, C7 | Deprecated (duplicate phase/rollout plan) |
| 15 | `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | C7 | Deprecated (split + normalized) |
| 16 | `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | C7 | Deprecated (duplicate risk/rollout) |
| 17 | `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | C7 | Deprecated (task graph normalized) |
| 18 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | C1, C5, C7 | Deprecated (worker variant merged) |
| 19 | `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | C5, C6 | Deprecated (worker variant merged) |
| 20 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | C1, C5, C7 | Deprecated (worker variant merged) |
| 21 | `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | C3, C7 | Deprecated (worker variant merged) |
| 22 | `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | C5, C6, C7 | Deprecated (worker variant merged) |
| 23 | `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | C1, C4, C7 | Deprecated (worker variant merged) |
| 24 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | C5 | Deprecated (worker variant merged) |
| 25 | `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | C7 | Deprecated (worker variant merged) |
| 26 | `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | C7 | Deprecated (worker variant merged) |

## 5) Explicit deprecated / non-canonical list with rationale

All 26 prior docs above are now **non-canonical historical references** for one reason: they are superseded by a single normalized contract set (C1..C7) with conflict resolution and implementation-grade parity requirements.  
No future implementation decision should rely on those files unless first re-imported into C1..C7 via explicit change control.

## 6) Change-control rule for future updates

Any parity, architecture, worker protocol, gate, or rollout change MUST update the relevant canonical doc(s):
- parity scope change -> C2
- state/control-plane contract change -> C3
- worker/role/skill contract change -> C4
- sequencing change -> C5
- release quality bar change -> C6
- risk/rollout/backlog change -> C7

