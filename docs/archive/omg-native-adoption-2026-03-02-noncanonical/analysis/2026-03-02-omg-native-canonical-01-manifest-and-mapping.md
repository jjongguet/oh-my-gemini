# OmG-native Adoption Canonical-7 Manifest and Source Mapping (Team Orchestration + Role/Skill)

Date: 2026-03-02  
Status: **Authoritative**  
Scope: Consolidation of the 26-document OmG-native adoption cycle into one canonical set

---

## 1) Canonical-7 (final authoritative set)

Exactly these seven documents are canonical for the current adoption program:

| Canonical ID | Path | Purpose |
|---|---|---|
| C1 | `docs/analysis/2026-03-02-omg-native-canonical-01-manifest-and-mapping.md` | Source-of-truth index, source mapping, deprecation ledger |
| C2 | `docs/analysis/2026-03-02-omg-native-canonical-02-adoption-decision-and-parity-requirements.md` | Final adopt/adapt/defer decisions and parity requirements |
| C3 | `docs/analysis/2026-03-02-omg-native-canonical-03-capability-delta-matrix.md` | Concrete OmG↔OmX/OmC delta matrix (commands/state/runtime/roles) |
| C4 | `docs/analysis/2026-03-02-omg-native-canonical-04-target-architecture-and-migration-constraints.md` | Target architecture, module boundaries, migration constraints |
| C5 | `docs/planning/2026-03-02-omg-native-canonical-05-phased-execution-and-ralplan-graph.md` | Canonical phase model and dependency-ordered execution graph |
| C6 | `docs/planning/2026-03-02-omg-native-canonical-06-acceptance-and-ci-gates.md` | Acceptance criteria and blocking CI/release gate model |
| C7 | `docs/planning/2026-03-02-omg-native-canonical-07-risk-rollout-and-deprecation-governance.md` | Risk register, rollout policy, rollback/deprecation governance |

Authority rule: if any older document conflicts with C1-C7, **C1-C7 win**.

---

## 2) Adversarial conflict resolution (final decisions)

The 26-doc set contained repeated but conflicting formulations. Canonical decisions:

1. **Phase model is fixed to 6 phases (0-5).**  
   0=Design lock, 1=Control-plane foundation, 2=Lifecycle CLI parity, 3=Worker protocol hardening, 4=Role/skill contract realization, 5=Reliability+rollout hardening.
2. **Minimal required role set is fixed to 3 roles:** `planner`, `executor`, `verifier`.  
   `reviewer` is optional extension.
3. **Lifecycle command parity target is fixed:** add `omg team status`, `omg team resume`, `omg team shutdown` while preserving `omg team run`.
4. **Task lifecycle mutation policy is fixed:** lifecycle field writes must go through claim/transition/release APIs (no direct overwrite paths in new code).
5. **Backend policy is fixed:** `tmux` stays default; `subagents` remains opt-in until gate evidence proves parity.
6. **Completion truth policy is fixed:** run completion requires legal task terminal states + verification evidence + role artifact integrity.

---

## 3) Source mapping (26 -> Canonical-7)

### 3.1 Analysis sources (9)

| Source doc | Primary canonical target(s) | Mapping rationale |
|---|---|---|
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | C2, C5, C6, C7 | Core thesis, phase/gate/risk baseline |
| `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | C3 | Command/state/worker/role delta table |
| `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | C4 | Layer/module migration constraints |
| `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | C2, C3, C4 | Adopt/adapt principles + architecture deltas |
| `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | C3, C4 | Additional parity detail and implementation anchors |
| `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | C2, C4, C6 | Worker draft synthesis merged into canonical requirements |
| `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | C2, C3, C7 | Worker draft deltas and invariants merged |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | C2, C3, C4 | Worker draft parity framing merged |
| `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | C2, C3, C4, C7 | Worker draft decisions/constraints merged |

### 3.2 Planning sources (16)

| Source doc | Primary canonical target(s) | Mapping rationale |
|---|---|---|
| `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | C5, C6 | Phase and gate baseline |
| `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | C6 | Acceptance and CI gate contract |
| `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | C5 | Alternative phased plan merged |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | C5, C7 | Phase plan + risk/rollout overlap |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | C5, C7 | Risk + task decomposition |
| `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | C7 | Detailed risk/rollout baseline |
| `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | C5 | Task dependency graph baseline |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | C2, C5, C7 | Worker synthesis merged |
| `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | C5, C6, C7 | Worker phase/gate/risk plan merged |
| `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | C2, C5, C6, C7 | Worker synthesis merged |
| `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | C4, C7 | Constraints and risks merged |
| `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | C5, C6 | Worker phase/gate decomposition merged |
| `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | C2, C5, C7 | Worker synthesis merged |
| `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | C5 | Worker phase sequencing merged |
| `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | C5 | Worker task graph merged |
| `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | C7 | Worker risk/rollout details merged |

### 3.3 Entry-point source (1)

| Source doc | Primary canonical target(s) | Mapping rationale |
|---|---|---|
| `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | C1, C5 | Previous entrypoint; now superseded by canonical manifest + canonical plan |

---

## 4) Explicit deprecated / non-canonical list (with rationale)

All 26 source documents listed in section 3 are now **non-canonical**.

Deprecation rationale (applies per-file):

1. **Redundancy:** same decisions repeated across worker-specific drafts and lead synthesis.
2. **Contradiction risk:** phase counts, role sets, and gate naming were inconsistent.
3. **Operational ambiguity:** multiple “master” docs created parallel sources of truth.
4. **Execution friction:** ralplan seeding required reconciliation before action.

Replacement rule:

- Strategy/decision questions -> C2
- Delta/parity detail -> C3
- Architecture and migration constraints -> C4
- Phase sequencing and dependency graph -> C5
- Acceptance and CI/release checks -> C6
- Risk/rollout/deprecation operations -> C7

---

## 5) Maintainer policy going forward

1. Do not add new “master synthesis” docs outside C1-C7.
2. Additive updates must modify the relevant canonical doc directly.
3. New worker drafts must be folded into canonical docs in the same cycle.
4. Release and tasking discussions must cite canonical IDs (C1..C7).

