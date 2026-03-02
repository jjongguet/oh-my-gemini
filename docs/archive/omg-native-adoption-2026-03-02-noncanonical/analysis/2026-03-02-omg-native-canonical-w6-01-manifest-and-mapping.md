# OmG-native Canonical-7 Manifest + Source Mapping (Worker 6)

Date: 2026-03-02  
Status: Authoritative set for Team Orchestration + Agent Role/Skill adoption

This manifest consolidates the **26-document OmG-native adoption batch** into one canonical set.

---

## 1) Canonical-7 authoritative set

Exactly these seven docs are canonical:

| Canonical ID | Path | Purpose |
|---|---|---|
| C1 | `docs/analysis/2026-03-02-omg-native-canonical-w6-01-manifest-and-mapping.md` | Source-of-truth index, mapping, deprecation ledger |
| C2 | `docs/analysis/2026-03-02-omg-native-canonical-w6-02-decision-and-parity-principles.md` | Final adopt/adapt/defer decisions + non-negotiable parity principles |
| C3 | `docs/analysis/2026-03-02-omg-native-canonical-w6-03-capability-parity-requirements.md` | Concrete parity requirement matrix (CLI/state/runtime/role-skill) |
| C4 | `docs/analysis/2026-03-02-omg-native-canonical-w6-04-target-architecture-and-migration-constraints.md` | Target architecture, module boundaries, migration constraints |
| C5 | `docs/planning/2026-03-02-omg-native-canonical-w6-05-phased-execution-and-ralplan-graph.md` | Fixed phase model + dependency-ordered execution graph |
| C6 | `docs/planning/2026-03-02-omg-native-canonical-w6-06-acceptance-and-ci-gates.md` | Acceptance criteria + blocking CI/release gates |
| C7 | `docs/planning/2026-03-02-omg-native-canonical-w6-07-risk-rollout-and-deprecation-governance.md` | Risk register, rollout rings, rollback + deprecation governance |

**Precedence rule:** if any non-canonical doc conflicts with C1..C7, C1..C7 win.

---

## 2) Adversarial conflict resolutions (locked)

1. **Phase count locked to 6 phases (0..5).**
2. **Minimum required role set locked to 3 roles:** `planner`, `executor`, `verifier`.
3. **Minimum skill adoption pack locked to:** `plan`, `team`, `review`, `verify`, `handoff`.
4. **Lifecycle command parity locked to:** `omg team run|status|resume|shutdown`.
5. **Lifecycle mutation policy locked to control-plane APIs only** (claim/transition/release).
6. **Backend posture locked:** tmux default, subagents opt-in until evidence gates pass.
7. **Completion truth policy locked:** run completion requires legal terminal task states + verification evidence + role artifact integrity.

---

## 3) Source mapping (26 docs -> Canonical-7)

### 3.1 Analysis sources (9)

| Source doc | Primary canonical destination |
|---|---|
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | C2, C5, C6, C7 |
| `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | C3 |
| `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | C4 |
| `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | C2, C3, C4 |
| `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | C3, C4 |
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | C2, C4, C6 |
| `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | C2, C3, C7 |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | C2, C3, C4 |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | C2, C3, C4 |

### 3.2 Planning sources (16)

| Source doc | Primary canonical destination |
|---|---|
| `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | C5, C6 |
| `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | C6 |
| `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | C5 |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | C5, C7 |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | C5, C7 |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | C7 |
| `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | C5 |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | C2, C5, C7 |
| `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | C5, C6, C7 |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | C2, C5, C6, C7 |
| `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | C4, C7 |
| `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | C5, C6 |
| `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | C2, C5, C7 |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | C5 |
| `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | C5 |
| `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | C7 |

### 3.3 Entry source (1)

| Source doc | Primary canonical destination |
|---|---|
| `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | C1, C5 |

---

## 4) Explicit deprecated / non-canonical list (with rationale)

The 26 source docs above are now **deprecated as non-canonical**.

### Why deprecated

1. Redundant copies of the same decision set across worker drafts.
2. Conflicting phase/gate/role wording across “master” documents.
3. Multiple competing “source of truth” files causing planning drift.
4. Harder execution seeding for ralplan/team tasking.

### Replacement lookup

- Decision and principles -> C2
- Capability parity requirements -> C3
- Architecture/migration constraints -> C4
- Phase + ralplan graph -> C5
- Acceptance/gates -> C6
- Risk/rollout/deprecation policy -> C7

---

## 5) Maintainer policy after consolidation

1. Do not create new “master synthesis” files outside C1..C7.
2. Update canonical docs directly when scope changes.
3. Worker drafts are temporary inputs; they must be folded into C1..C7 in-cycle.
4. Team planning and implementation tasks must cite canonical IDs C1..C7.
