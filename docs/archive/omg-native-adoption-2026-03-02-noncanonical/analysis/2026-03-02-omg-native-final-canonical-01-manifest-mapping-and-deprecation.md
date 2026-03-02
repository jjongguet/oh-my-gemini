# OmG-native Final Canonical Set (01/07): Manifest, 26→7 Mapping, and Deprecation Ledger

Date: 2026-03-02  
Status: **Final authoritative set for Team Orchestration + Agent Role/Skill adoption**

## 1) Canonical-7 (the only authoritative set)

Exactly these seven docs are canonical for this adoption program:

| ID | Path | Purpose |
|---|---|---|
| FC1 | `docs/analysis/2026-03-02-omg-native-final-canonical-01-manifest-mapping-and-deprecation.md` | SSOT index, mapping, conflict resolution, deprecations |
| FC2 | `docs/analysis/2026-03-02-omg-native-final-canonical-02-parity-decisions-and-requirements.md` | Adopt/adapt/defer decisions + parity requirements |
| FC3 | `docs/analysis/2026-03-02-omg-native-final-canonical-03-target-architecture-and-contracts.md` | Target architecture and normative contracts |
| FC4 | `docs/planning/2026-03-02-omg-native-final-canonical-04-phased-execution-plan.md` | Phase model, sequencing, and implementation plan |
| FC5 | `docs/planning/2026-03-02-omg-native-final-canonical-05-acceptance-and-ci-gates.md` | Acceptance criteria and CI/release gate contract |
| FC6 | `docs/planning/2026-03-02-omg-native-final-canonical-06-risk-rollout-and-governance.md` | Risk register, rollout, rollback, governance |
| FC7 | `docs/planning/2026-03-02-omg-native-final-canonical-07-ralplan-task-decomposition.md` | Dependency-aware execution backlog for `/ralplan` |

**Precedence rule:** if any other adoption doc conflicts with FC1–FC7, FC1–FC7 win.

---

## 2) Hard conflict resolutions (final decisions)

1. **Phase model fixed:** Phase 0→5 (six phases, no alternates).
2. **Lifecycle command parity target fixed:** `omg team run|status|resume|shutdown`.
3. **Role baseline fixed:** `planner`, `executor`, `verifier`.
4. **Skill baseline fixed:** `plan`, `execute`, `review`, `verify`, `handoff`.
5. **Gate taxonomy fixed:** Existing baseline gates + new adoption gates `G1..G5` (see FC5).
6. **Mutation discipline fixed:** task lifecycle mutations must go through claim/transition/release APIs (no direct lifecycle-field overwrite path in new runtime logic).
7. **Backend policy fixed:** tmux remains default; subagents stays opt-in until gate evidence is green.

---

## 3) Source set definition (26 docs)

This conversion covers the current 26-doc adoption set:
- 9 analysis docs
- 17 planning docs

(Operationally: all `2026-03-02-omg-native-*.md` in `docs/analysis`+`docs/planning`, plus `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md`.)

---

## 4) Full 26→7 mapping (explicit)

| # | Source doc | Primary canonical target | Mapping rationale |
|---|---|---|---|
| 1 | `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md` | FC2 | Worker delta inventory consolidated into final parity requirements |
| 2 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md` | FC2 | Worker synthesis merged into final adopt/adapt decisions |
| 3 | `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md` | FC2 | Prior master thesis retained, normalized, and finalized |
| 4 | `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md` | FC3 | Architecture/module constraints folded into normative contracts |
| 5 | `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md` | FC2 | Delta matrix normalized into requirement IDs |
| 6 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md` | FC2 | Worker parity framing merged into final requirement table |
| 7 | `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md` | FC2 | Worker adoption decisions merged and de-duplicated |
| 8 | `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md` | FC2 | Bilingual synthesis normalized to one canonical language/style |
| 9 | `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md` | FC2 | Cross-product deltas reduced to concrete OmG parity requirements |
| 10 | `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md` | FC5 | Gate criteria retained, naming normalized |
| 11 | `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md` | FC4 | Phase plan retained as base and conflict-resolved |
| 12 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md` | FC4 | Worker phase variant merged into canonical sequence |
| 13 | `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md` | FC4 | Alternate phase breakdown de-duplicated into final plan |
| 14 | `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md` | FC7 | Worker decomposition absorbed into final dependency graph |
| 15 | `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md` | FC6 | Worker rollout/risk details merged into canonical governance |
| 16 | `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md` | FC6 | Constraint-driven risk notes merged into final risk policy |
| 17 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md` | FC4 | Worker synthesis planning content merged into final phases |
| 18 | `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md` | FC4 | Worker synthesis planning content merged into final phases |
| 19 | `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md` | FC4 | Worker execution details merged into canonical milestones |
| 20 | `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md` | FC6 | Risk/rollout and go/no-go criteria merged into governance |
| 21 | `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md` | FC5 | Gate matrix normalized and linked to canonical task backlog |
| 22 | `docs/planning/2026-03-02-omg-native-phased-execution-plan.md` | FC4 | Parallel phase plan merged into one ordering |
| 23 | `docs/planning/2026-03-02-omg-native-ralplan-briefing-pack.md` | FC7 | Briefing elements preserved in final task seed format |
| 24 | `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md` | FC7 | Existing task list used as baseline for canonical backlog |
| 25 | `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md` | FC6 | Hybrid risk/rollout/task content split into risk + backlog canon |
| 26 | `docs/planning/2026-03-02-omg-native-risk-register-rollout.md` | FC6 | Prior risk register normalized to one severity/governance model |

---

## 5) Explicit deprecated / non-canonical list with rationale

### 5.1 Deprecated set (superseded)
All 26 source docs listed in section 4 are **deprecated as authoritative docs** and now treated as archival inputs.

### 5.2 Why deprecated

1. Repetition across worker drafts and "master" docs.
2. Conflicting phase models, gate names, and role/skill baseline definitions.
3. Multiple overlapping "source of truth" candidates.
4. Higher execution risk from ambiguous references during implementation.

### 5.3 Replacement rules

- Strategy / parity decision questions -> FC2
- Architecture / contracts / constraints -> FC3
- Sequencing / milestones / ownership -> FC4 + FC7
- Acceptance and CI/release checks -> FC5
- Risk, rollout, rollback, deprecation policy -> FC6

### 5.4 Additional non-canonical artifacts

The following are **not** in the 26-doc source set and are non-authoritative for adoption decisions:
- `docs/analysis/omc-omx-omg-adversarial-comparison.md`
- `docs/analysis/omc-omx-team-orchestration-role-skill-todo.md`
- `docs/planning/2026-03-02-team-orchestration-role-skill-master-todo.md`
- Any draft whose filename includes worker suffixes but is not FC1–FC7

They may be used for background only.

---

## 6) Maintenance policy (enforced)

1. Do not create new “master synthesis” docs for this scope outside FC1–FC7.
2. Update canonical docs in place; do not fork parallel replacements.
3. Every task/PR must reference relevant FC requirement IDs and gate IDs.
4. Any future consolidation must update FC1 mapping + deprecation ledger in same change.

