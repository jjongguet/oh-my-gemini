# OmG-native Canonical-7 Manifest, Mapping, and Deprecation Ledger (Worker 4)

Date: 2026-03-02  
Status: **Authoritative for Worker-4 handoff**  
Scope: Team orchestration + agent role/skill adoption corpus consolidation

## 1) Canonical-7 authoritative set (exactly seven docs)

| Canonical ID | Path | Authority domain |
|---|---|---|
| C1 | `docs/analysis/2026-03-02-omg-native-canonical7-01-manifest-mapping-and-deprecations-worker-4.md` | Canonical index, source mapping, explicit deprecation list |
| C2 | `docs/analysis/2026-03-02-omg-native-canonical7-02-adoption-decisions-and-parity-requirements-worker-4.md` | Final adopt/adapt/reject decisions + parity requirements |
| C3 | `docs/analysis/2026-03-02-omg-native-canonical7-03-target-architecture-and-control-plane-contract-worker-4.md` | Target architecture + control-plane contract + file-level implementation map |
| C4 | `docs/planning/2026-03-02-omg-native-canonical7-04-migration-constraints-and-adr-policy-worker-4.md` | Migration constraints + ADR/deprecation governance policy |
| C5 | `docs/planning/2026-03-02-omg-native-canonical7-05-phased-execution-plan-worker-4.md` | Single canonical phase model, milestones, dependency graph |
| C6 | `docs/planning/2026-03-02-omg-native-canonical7-06-acceptance-ci-gates-and-verification-worker-4.md` | Acceptance criteria, CI gates, verification evidence contract |
| C7 | `docs/planning/2026-03-02-omg-native-canonical7-07-risk-rollout-and-ralplan-decomposition-worker-4.md` | Risk register, rollout rings, rollback, ralplan-ready decomposition |

**Precedence rule:** If any non-C1..C7 document conflicts with C1..C7, C1..C7 win.

## 2) Adversarial contradiction resolutions (locked)

1. **Phase model locked to six phases (0..5)**; all 5-phase/7-phase variants are deprecated.
2. **Gate taxonomy locked to C0..C7** (C0/C1/C2 existing + C3..C7 adoption gates).
3. **Operator command target locked**: `omg team run|status|resume|shutdown` (no alternate operator verb sets).
4. **Task mutation policy locked**: claim/transition/release APIs are canonical; direct lifecycle overwrites are compatibility-only.
5. **Role parity v1 locked**: minimum required roles = `planner`,`executor`,`verifier`; optional roles are non-blocking extensions.
6. **Runtime posture locked**: tmux remains default; subagents remain opt-in until C5/C7 evidence is green.

## 3) 26-source to Canonical-7 mapping (and explicit non-canonical status)

| # | Source document (now non-canonical) | Mapped canonical doc(s) | Deprecation rationale |
|---:|---|---|---|
| 1 | `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | C2,C3,C4 | Worker-specific delta draft; merged into final decisions/requirements. |
| 2 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | C2,C3,C5 | Worker-specific synthesis duplicate; replaced by canonical decision + plan docs. |
| 3 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | C2,C3,C5,C6,C7 | Legacy master synthesis overlapped every domain; split into bounded canonical docs. |
| 4 | `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | C3,C4 | Architecture detail retained, but constraints normalized into one policy doc. |
| 5 | `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | C2 | Delta matrix consolidated with conflicting matrices into one final matrix. |
| 6 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | C2,C3 | Worker-specific comparison merged into canonical delta + architecture decisions. |
| 7 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | C2,C3,C4 | Worker-specific delta merged; removed duplicate recommendation sections. |
| 8 | `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | C2,C3,C4 | Mixed-language master synthesis replaced by normalized canonical wording. |
| 9 | `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | C6 | Gate proposals kept; naming normalized into C0..C7 single taxonomy. |
| 10 | `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | C5,C6 | Phase plan retained; phase model reconciled with other conflicting variants. |
| 11 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | C5 | Worker-specific plan duplicate merged into canonical phased execution. |
| 12 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | C5,C7 | General plan retained as inputs; contradictory phase ordering removed. |
| 13 | `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | C5,C7 | Task graph retained, reformatted into canonical dependency decomposition. |
| 14 | `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | C7 | Risk and rollout insights retained; merged with duplicate registers. |
| 15 | `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | C4,C7 | Constraint register retained; overlaps removed and policy made normative. |
| 16 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | C2,C5,C7 | Worker synthesis merged; conflicting gate/phase terms normalized. |
| 17 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | C2,C5,C6,C7 | Worker synthesis merged; duplicate master-summary sections removed. |
| 18 | `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | C5,C6,C7 | Phased execution details retained as input only. |
| 19 | `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | C2,C5,C7 | Worker synthesis merged; removed conflicting recommendation wording. |
| 20 | `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | C5,C6,C7 | Gate/decomposition content merged into canonical phase + gate docs. |
| 21 | `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | C5 | Alternate phase structure deprecated; canonical structure now fixed. |
| 22 | `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | C1,C5 | Briefing pack superseded by this manifest + canonical phase plan. |
| 23 | `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | C5,C7 | Task decomposition retained but deduplicated and dependency-normalized. |
| 24 | `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | C7 | Combined doc decomposed into canonical risk + task sections. |
| 25 | `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | C7 | Risk register kept, duplicate wave terminology normalized to Rings 0..3. |
| 26 | `docs/planning/2026-03-02-team-orchestration-role-skill-master-todo.md` | C2,C5,C6 | Master TODO retained as evidence source, replaced by canonical requirements/tasks. |

## 4) Explicit deprecated/non-canonical list with rationale

All 26 source documents listed in Section 3 are **explicitly deprecated as authoritative references**.

Rationale categories:

- **R1 Redundancy**: repeated “master synthesis” narratives across worker-specific drafts.
- **R2 Contradiction**: conflicting phase counts, gate names, and role minimums.
- **R3 Ambiguity**: multiple docs claiming “master” status with no tie-break rule.
- **R4 Operational friction**: execution teams must reconcile documents before coding, slowing delivery.

Replacement rule: use C2 for strategy/parity requirements, C3 for architecture contract, C5 for execution sequence, C6 for gate truth, C7 for rollout/risk.

## 5) Maintenance policy for new work

1. Do not create new “master synthesis” artifacts for this program outside C1..C7.
2. New findings must patch the appropriate canonical doc directly in the same change set.
3. Team tasking/ralplan prompts must cite canonical IDs (C1..C7) instead of legacy docs.
4. Deprecated docs may remain for historical traceability but cannot override canonical requirements.

