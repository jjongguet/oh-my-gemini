# OmG-native Canonical-7 Manifest and 26→7 Mapping (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Objective

This manifest converts the current **26-document OmG-native adoption output** into **exactly 7 canonical source-of-truth documents** for OmG adoption of OmC/OmX orchestration + role/skill capabilities.

## 2) Canonical-7 Set (Authoritative)

| Canonical ID | Path | Scope authority |
|---|---|---|
| C01 | `docs/analysis/2026-03-02-omg-native-canonical-01-decision-and-parity-deltas-worker-1.md` | Final adoption decisions and parity targets |
| C02 | `docs/analysis/2026-03-02-omg-native-canonical-02-target-architecture-and-control-plane-contract-worker-1.md` | Architecture and control-plane contracts |
| C03 | `docs/analysis/2026-03-02-omg-native-canonical-03-migration-constraints-and-policy-worker-1.md` | Migration constraints, compatibility, governance |
| C04 | `docs/planning/2026-03-02-omg-native-canonical-04-phased-execution-plan-worker-1.md` | Program sequencing and phase-level outcomes |
| C05 | `docs/planning/2026-03-02-omg-native-canonical-05-acceptance-and-ci-gates-worker-1.md` | Acceptance criteria and CI/release gates |
| C06 | `docs/planning/2026-03-02-omg-native-canonical-06-risk-rollout-and-rollback-worker-1.md` | Risk register, rollout rings, rollback operations |
| C07 | `docs/planning/2026-03-02-omg-native-canonical-07-ralplan-task-decomposition-worker-1.md` | Execution task graph and dependency model |

## 3) Source-of-Truth Rules

1. Decision conflicts: C01 wins.
2. Architecture/interface conflicts: C02 wins.
3. Compatibility/governance conflicts: C03 wins.
4. Sequencing conflicts: C04 wins.
5. Quality gate conflicts: C05 wins.
6. Rollout/operations conflicts: C06 wins.
7. Task dependency conflicts: C07 wins.

## 4) Contradictions Resolved

1. **Phase model divergence (5 vs 6 vs 7 phases):** resolved to **6 phases (0–5)** in C04.
2. **Role breadth divergence:** resolved to core mandatory set (planner/executor/verifier), with extension wave later.
3. **CLI breadth divergence:** resolved to orchestration-critical commands only (`status/resume/shutdown`).
4. **Subagents parity claims:** resolved to opt-in path until truthfulness gates pass.
5. **Lifecycle mutation ambiguity:** resolved to claim-token-only lifecycle mutations in C02/C05.

## 5) 26→7 Mapping Matrix

| # | Source doc (26-doc set) | Canonical target(s) | Mapping rationale |
|---:|---|---|---|
| 1 | `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | C01, C03 | Decision synthesis + constraints |
| 2 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | C01 | Executive decision consolidation |
| 3 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | C01 | Primary parity decision material |
| 4 | `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | C02, C03 | Architecture + migration boundaries |
| 5 | `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | C01, C02 | Capability deltas and implementation focus |
| 6 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | C01 | Comparative decision support |
| 7 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | C01 | Comparative decision support |
| 8 | `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | C01, C03 | Synthesis + adoption principles |
| 9 | `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | C01, C02 | Cross-stack technical delta inputs |
| 10 | `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | C05 | Acceptance/gate baseline |
| 11 | `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | C04, C05 | Phases + gate planning |
| 12 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | C04 | Phase variant merged into canonical sequencing |
| 13 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | C04 | Phase variant merged into canonical sequencing |
| 14 | `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | C07 | Task decomposition input |
| 15 | `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | C06 | Risk/rollout input |
| 16 | `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | C03, C06 | Constraints + risks |
| 17 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | C01, C04 | Decision + sequencing input |
| 18 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | C01, C04 | Decision + sequencing input |
| 19 | `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | C04, C05, C06 | Phase/gate/risk blend decomposed canonically |
| 20 | `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | C01, C04, C05 | Synthesized into decisions + plan + gates |
| 21 | `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | C04, C05, C07 | Multi-domain plan split into canonical docs |
| 22 | `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | C04 | Phase variant merged |
| 23 | `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | C04, C05, C06, C07 | Briefing artifact redistributed to authoritative docs |
| 24 | `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | C07 | Primary task graph source |
| 25 | `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | C06, C07 | Risk + task split |
| 26 | `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | C06 | Risk/rollout baseline |

## 6) Execution Instruction

All future planning/implementation work should reference C01–C07 only. The prior 26 documents are retained for traceability but are non-authoritative after this manifest.
