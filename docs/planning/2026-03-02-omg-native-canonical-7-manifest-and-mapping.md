# OmG-Native Canonical-7 Manifest, Mapping, and Deprecation Register

Status: **Canonical manifest (authoritative index)**  
Date: 2026-03-02

Archive root for non-canonical materials:

- `docs/archive/omg-native-adoption-2026-03-02-noncanonical/`

This document converts the prior 26-document adoption corpus into one authoritative canonical set.

## 1) Final authoritative set (Canonical-7)

1. `docs/analysis/2026-03-02-omg-native-canonical-01-decision-and-principles.md`
2. `docs/analysis/2026-03-02-omg-native-canonical-02-capability-parity-requirements.md`
3. `docs/analysis/2026-03-02-omg-native-canonical-03-architecture-and-migration-constraints.md`
4. `docs/planning/2026-03-02-omg-native-canonical-04-phased-execution-plan.md`
5. `docs/planning/2026-03-02-omg-native-canonical-05-acceptance-and-ci-gates.md`
6. `docs/planning/2026-03-02-omg-native-canonical-06-risk-rollout-and-rollback.md`
7. `docs/planning/2026-03-02-omg-native-canonical-07-ralplan-task-decomposition.md`

Use this order for reading and implementation.

## 2) Source corpus definition (26 documents)

The converted corpus is the 2026-03-02 OmG-native adoption batch:

- Analysis (9): master syntheses + delta matrices + worker analyses
- Planning (16): phased plans + gate/risk/ralplan artifacts
- Briefing pack (1): adoption entrypoint

Total: **26** source documents.

## 3) Source -> canonical mapping

Note:

- The table below records the original source paths used during consolidation.
- Those non-canonical source documents have now been relocated under the archive root above, preserving their `analysis/` or `planning/` subpath for audit/history.

| Source document | Canonical destination(s) |
|---|---|
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | Canonical 01, 02, 03 |
| `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | Canonical 02 |
| `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | Canonical 03 |
| `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | Canonical 01, 02, 03 |
| `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | Canonical 02 |
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | Canonical 01, 03 |
| `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | Canonical 02, 03 |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | Canonical 01, 02 |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | Canonical 02, 03 |
| `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | Canonical 04 |
| `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | Canonical 05 |
| `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | Canonical 04 |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | Canonical 04 |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | Canonical 06, 07 |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | Canonical 06 |
| `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | Canonical 07 |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | Canonical 01, 04, 06 |
| `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | Canonical 04, 05 |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | Canonical 01, 04, 06, 07 |
| `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | Canonical 03, 06 |
| `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | Canonical 04, 05, 07 |
| `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | Canonical 01, 04 |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | Canonical 04 |
| `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | Canonical 07 |
| `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | Canonical 06 |
| `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | Canonical 01..07 (index role absorbed by this manifest) |

## 4) Contradictions resolved by canonicalization

| Previous drift | Canonical resolution |
|---|---|
| Phase count mismatch (0..4 vs 0..5 vs 0..6 variants) | Fixed to Phase 0..5 |
| Gate naming mismatch (R*, A*, C* mixed) | Fixed to C0..C7 |
| Rollout wording mismatch (Wave/Stage/Ring mixed) | Fixed to Ring 0..3 |
| Skill set mismatch (`execute` vs `team` set) | Fixed initial skill set: `plan`, `team`, `review`, `verify`, `handoff` |
| Role breadth mismatch (3-core vs 4-core) | Fixed initial role set: planner/executor/verifier |

## 5) Deprecated / non-canonical list (explicit with rationale)

All source documents in Section 3 are now **deprecated for authority** (archive/reference only).  
Per-file rationale:

| Deprecated file | Rationale category |
|---|---|
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | Superseded by consolidated canonical decision + architecture split |
| `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | Superseded by canonical parity requirements matrix |
| `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | Superseded by canonical architecture constraints |
| `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | Superseded by canonical decision + parity + architecture set |
| `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | Duplicate delta matrix terminology |
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | Worker-specific synthesis draft |
| `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | Worker-specific analysis draft |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | Worker-specific analysis draft |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | Worker-specific analysis draft |
| `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | Superseded by fixed canonical phase model |
| `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | Superseded by canonical gate taxonomy |
| `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | Duplicate phase taxonomy |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | Duplicate phase taxonomy |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | Split into canonical risk + canonical task decomposition |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | Superseded by canonical risk/rollout model |
| `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | Superseded by canonical dependency graph |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | Worker-specific planning synthesis draft |
| `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | Worker-specific phased planning draft |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | Worker-specific planning synthesis draft |
| `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | Worker-specific migration/risk draft |
| `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | Worker-specific merged planning draft |
| `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | Worker-specific planning synthesis draft |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | Worker-specific phased planning draft |
| `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | Worker-specific task decomposition draft |
| `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | Worker-specific risk/rollout draft |
| `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | Replaced by canonical manifest as authoritative index |

Policy:

1. Keep deprecated files for audit trail/history.
2. Do not extend deprecated files with new requirements.
3. Any new adoption requirement must update Canonical 01..07 and this manifest if indexing changes.
