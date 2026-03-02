# MASTER SYNTHESIS — OmG-native Adoption of OmC/OmX Team Orchestration + Role/Skill Capabilities

Date: 2026-03-02  
Status: Draft for execution planning  
Scope: `oh-my-gemini` implementation and docs in this repository

This is the canonical synthesis document for the current analysis cycle.

---

## 1) Executive Decision

OmG should **not** clone OmC/OmX wholesale.  
OmG should **absorb their control-plane rigor** while preserving OmG’s product identity:

- extension-first UX,
- tmux default runtime,
- subagents opt-in,
- strict verification/gating culture.

### Strategic statement

> Keep OmG’s architecture and packaging model. Replace weak lifecycle semantics with OmX-grade claim/transition guarantees and OmC-grade runtime-operability patterns.

---

## 2) Current Position (As-Is) — What OmG already does well

1. **Clear architecture seams**
   - runtime backend contract is explicit (`RuntimeBackend`), with `tmux` + `subagents` implementations.
2. **Deterministic orchestrator phase model**
   - `plan -> exec -> verify -> fix -> completed|failed`.
3. **Strong verification posture**
   - publish gating and explicit verification suites are already formalized.
4. **Extension-first packaging**
   - Gemini extension artifacts + CLI coexistence are well aligned for Gemini-native UX.

---

## 3) Primary Gaps (As-Is -> To-Be)

## Gap A — Lifecycle operator surface is too thin

- OmG currently supports `team run` only.
- Missing first-class status/resume/shutdown verbs for long-running operations.

**Impact:** degraded operator control, weaker incident handling, no native resumability contract.

## Gap B — Task lifecycle API depth is insufficient

- OmG supports CAS-style task writes.
- OmG does not yet expose first-class claim-token lifecycle transitions in its own code.

**Impact:** weaker concurrency safety, more protocol ambiguity for workers.

## Gap C — Subagents execution semantics are still bootstrap-level

- subagents backend can report deterministic `completed` snapshots.

**Impact:** role assignment exists, but execution evidence remains shallow.

## Gap D — Role/skill surface mismatch

- role catalog exists,
- extension skill surface is still minimal (`plan` only).

**Impact:** role declarations outpace practical role workflows.

## Gap E — Cross-process durability/locking parity

- OmG has atomic temp+rename writes,
- but no explicit claim lock primitives equivalent to OmX/OmC task lock semantics.

**Impact:** multi-worker state integrity risk under contention.

---

## 4) OmG-native Target Architecture (Delta Design)

## 4.1 Architectural layers

1. **Team Runtime Layer** (existing)
   - keeps backend abstraction (`tmux` default, `subagents` opt-in).
2. **Team Control Plane Layer** (new/expanded)
   - lifecycle-safe task mutation APIs:
     - claim,
     - transition,
     - release,
     - dependency readiness checks.
3. **Worker Protocol Layer** (new/standardized)
   - ACK + claim-before-work + structured completion evidence.
4. **Role/Skill Contract Layer** (new)
   - maps role IDs to skill entry points, required inputs, output schema, and verification obligations.
5. **Verification & Gate Layer** (expanded)
   - adds team-control-plane parity tests/gates.

## 4.2 Key architectural deltas

- Keep runtime backend contract unchanged at interface level.
- Introduce explicit control-plane module under `src/team` (stateful orchestration mutation logic).
- Wire CLI lifecycle verbs to control plane + runtime handles.
- Introduce artifact-level truth model:
  - completion is valid only when:
    - task transitions are legal,
    - verify baseline is true,
    - worker evidence is present.

---

## 5) Migration Constraints (Must-Hold)

1. **Do not break extension-first UX**
   - extension commands remain public entry point for Gemini users.
2. **Keep tmux as default backend**
   - subagents remain explicit opt-in until parity is proven.
3. **Keep existing state root compatibility**
   - continue `.omg/state/team/<team>/...` canonical artifacts.
4. **Maintain ESM + NodeNext conventions**
   - no build/runtime contract regressions.
5. **No generated artifact edits**
   - avoid manual edits in `dist/`, `.omg/`, `.omx/` except state behavior tests.
6. **Back-compat for existing `team run` flows**
   - new lifecycle verbs augment, not replace, current invocation.

---

## 6) Phased Execution Plan (summary)

Detailed implementation plan is in:

- `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md`

Summary:

- **Phase 0:** Control-plane schema + API contracts (claim/transition/release)
- **Phase 1:** CLI lifecycle verbs (`status/resume/shutdown`)
- **Phase 2:** Worker protocol standardization + tmux dispatch wiring
- **Phase 3:** Role/skill contract + extension skill expansion
- **Phase 4:** Reliability hardening + rollout completion

---

## 7) Acceptance Criteria (Program-level)

A migration iteration is complete only if all pass:

1. Lifecycle operability
   - `omg team status|resume|shutdown` work on real state.
2. Task lifecycle integrity
   - illegal transitions and stale claims are rejected deterministically.
3. Worker protocol integrity
   - worker cannot execute assigned task without successful claim.
4. Runtime evidence integrity
   - completion requires explicit verify baseline + terminal task correctness.
5. Role/skill integrity
   - selected role produces required artifact schema and verification evidence.
6. CI integrity
   - publish gate includes new team control-plane contract checks.

---

## 8) Test / CI Gate Expansion

Detailed gate matrix is in:

- `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md`

Required additions:

1. **New reliability suite for task lifecycle contract**
   - claim conflict,
   - dependency blocked claim,
   - lease expiry,
   - transition legality.
2. **Integration suite for lifecycle verbs**
   - run -> status -> shutdown,
   - run -> interrupt -> resume.
3. **Role/skill integration suite**
   - role selection + expected evidence artifacts.
4. **CI gate composition update**
   - include the above in blocking path before publish.

---

## 9) Risk Register (Top program risks)

Full register:

- `docs/planning/2026-03-02-omg-native-risk-register-rollout.md`

Top risks:

1. false-green completion due to shallow runtime evidence,
2. race conditions in task lifecycle writes,
3. CLI UX breakage during lifecycle command expansion,
4. subagents parity over-promising before runtime truth is hardened,
5. doc/command drift between extension and CLI surfaces.

---

## 10) Rollout Strategy

Detailed strategy:

- `docs/planning/2026-03-02-omg-native-risk-register-rollout.md`

Rollout waves:

1. internal maintainer dogfood,
2. opt-in preview (feature flags),
3. default-enable lifecycle control plane,
4. deprecate compatibility bypasses after evidence threshold.

---

## 11) ralplan-ready Decomposition

Canonical decomposition:

- `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`

This provides task IDs, dependencies, owners, DoD, and verification commands suitable for direct `/ralplan` execution.

---

## 12) Final Recommendation

If OmG executes only one priority set, do this first:

1. claim/transition/release control plane,
2. lifecycle verbs,
3. worker protocol + evidence enforcement,
4. CI gate hardening.

These four moves deliver the largest reliability gain while staying fully OmG-native.

