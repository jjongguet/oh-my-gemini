# OmG-native phased execution plan, acceptance criteria, CI gates, and ralplan-ready decomposition (Worker 5)

Date: 2026-03-02  
Author: worker-5

---

## 1) Delivery goal

Land OmC/OmX-grade team orchestration + role/skill capability in OmG **without losing OmG’s extension-first, typed, deterministic posture**.

Success means:

- lifecycle operations are OmG-native (`run/status/resume/shutdown`)
- control-plane writes are contract-driven and auditable
- role assignment produces verifiable artifacts
- release gates prevent false-green completion

---

## 2) Phased execution plan

## Phase 0 — Decision lock + contracts (foundational)

**Objective**: freeze canonical contracts before feature coding.

Deliverables:

1. team control-plane contract doc (`status/resume/shutdown/claim/transition`)
2. worker protocol spec (ACK/claim/result/idle)
3. role-skill contract schema (for `planner/executor/verifier` minimum)
4. compatibility policy (`OMX_*` + legacy flags deprecation policy)

Acceptance criteria:

- all four contracts merged and cross-linked from docs index
- command/help/docs wording aligned
- no implementation work starts before contract approval

## Phase 1 — Lifecycle command surface + control-plane MVP

**Objective**: make OmG operationally complete for team lifecycle.

Deliverables:

1. `omg team status`
2. `omg team resume`
3. `omg team shutdown`
4. control-plane service module wired to state store + runtime adapters

Acceptance criteria:

- lifecycle commands available in CLI help and docs
- state-derived status output deterministic (json + human output)
- resume/shutdown exercise coherent phase transitions and artifacts

## Phase 2 — Worker protocol hardening

**Objective**: enforce runtime-safe worker lifecycle semantics.

Deliverables:

1. runtime-enforced ACK presence before task execution continues
2. claim/token lifecycle checks integrated into orchestration path
3. standard completion evidence schema in task result
4. idle status write contract after terminal task completion

Acceptance criteria:

- missing ACK or missing claim becomes explicit failure reason
- task completion without evidence is rejected in verify stage
- worker status consistency is observable in monitor snapshots

## Phase 3 — Role/skill operationalization

**Objective**: convert role catalog from metadata to executable contract.

Deliverables:

1. role-skill mapping registry (at least planner/executor/verifier)
2. extension skill expansion (`team`, `review`, `verify`, `handoff`)
3. stage handoff artifact template (`plan -> exec -> verify -> fix`)
4. role artifact collector in `.omg/state/team/<team>/artifacts/`

Acceptance criteria:

- role-selected runs emit role-specific artifacts with schema pass
- verify stage reads and validates required role artifacts
- unknown/unmapped role fails fast with actionable error

## Phase 4 — Reliability + deprecation hardening

**Objective**: remove false-green paths and stabilize CI behavior.

Deliverables:

1. strict-mode blocking for legacy success toggles
2. env namespace migration (`OMG_TEAM_*` canonical, `OMX_*` compatibility read)
3. status truth checks from merged runtime + persisted telemetry
4. flake-resistant live lifecycle e2e for tmux backend

Acceptance criteria:

- CI blocks release if legacy toggles are used in release jobs
- namespace migration telemetry shows no bootstrap regressions in canary
- reliability suite covers new failure taxonomy

## Phase 5 — Rollout and GA

**Objective**: make OmG-native lifecycle + role/skill model the default.

Deliverables:

1. GA release notes + migration guide
2. operator runbook fully OmG-native
3. canary/GA telemetry summary
4. cleanup PR removing deprecated compatibility paths

Acceptance criteria:

- docs/testing no longer require OmX command fallback for OmG lifecycle ops
- two consecutive release cycles with stable gates
- rollback path documented and tested

---

## 3) Acceptance criteria matrix (phase x quality axis)

| Quality axis | P0 | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|---|
| Contract clarity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLI completeness | ◻️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Worker lifecycle safety | ◻️ | ◻️ | ✅ | ✅ | ✅ | ✅ |
| Role artifact verifiability | ◻️ | ◻️ | ◻️ | ✅ | ✅ | ✅ |
| False-green prevention | ◻️ | ◻️ | ◻️ | ◻️ | ✅ | ✅ |
| Operator usability | ◻️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Release readiness | ◻️ | ◻️ | ◻️ | ◻️ | ✅ | ✅ |

Legend: ✅ required, ◻️ not required in that phase.

---

## 4) Test/CI gate plan (incremental)

## 4.1 Existing gate alignment

Continue honoring current gates:

- C0: install/global contract
- C1: quality baseline (`typecheck/build/smoke/integration/reliability/verify`)
- C2: publish gate

## 4.2 New adoption gates

### A1 — lifecycle command contract gate

Required checks:

- command parsing tests for `team status/resume/shutdown`
- docs snapshot parity against CLI help text

Pass condition:

- command/help/docs mismatch count = 0

### A2 — control-plane integrity gate

Required checks:

- claim/transition/release invariants
- CAS mismatch + lease expiry deterministic failures
- no direct-write bypass in production code paths

Pass condition:

- all lifecycle state transitions are auditable with causal evidence

### A3 — worker protocol gate

Required checks:

- missing ACK failure path
- missing claim failure path
- completion evidence schema validation
- idle status write enforcement

Pass condition:

- worker protocol violations are surfaced as deterministic failed reasons

### A4 — role/skill evidence gate

Required checks:

- mapped roles produce required artifacts
- verify reads role artifacts and passes/fails deterministically
- unknown role mapping fails fast

Pass condition:

- role contract compliance >= 100% for required core roles

### A5 — deprecation safety gate

Required checks:

- release jobs fail on legacy toggles
- compatibility namespace telemetry below defined failure threshold

Pass condition:

- legacy success paths cannot ship in GA

---

## 5) Rollout strategy

## 5.1 Rollout stages

1. **Internal dev-only (feature flags on)**
   - gather lifecycle + protocol telemetry
2. **Canary (opt-in default for selected teams)**
   - run live team workloads through OmG-native lifecycle commands
3. **Soft default (enabled by default, rollback available)**
   - compatibility mode still available but noisy
4. **GA (strict mode)**
   - legacy toggle paths blocked in release pipeline
5. **Post-GA cleanup**
   - remove deprecated code paths and docs

## 5.2 Rollback triggers

Roll back to previous stage when:

- canary failure rate crosses threshold,
- worker bootstrap regression appears after namespace changes,
- status truth mismatch or verify false-green incident is observed.

## 5.3 Rollout metrics

Track at minimum:

1. team lifecycle command success rate
2. worker protocol violation rate
3. role artifact compliance rate
4. verify false-green incident count
5. shutdown cleanup success rate

---

## 6) Ralplan-ready task decomposition

Task IDs below are intentionally structured for dependency-aware execution.

| ID | Subject | Type | Depends on | Primary files/areas | DoD |
|---|---|---|---|---|---|
| RP-01 | Author control-plane contract spec | docs | - | `docs/architecture/*` | spec approved |
| RP-02 | Define worker protocol v1 | docs/spec | RP-01 | `docs/architecture`, `docs/testing` | protocol checklist complete |
| RP-03 | Define role-skill contract schema | docs/spec | RP-01 | `docs/architecture` | schema for core roles |
| RP-04 | Add CLI parser: `team status` | code | RP-01 | `src/cli/*` | command available + tests |
| RP-05 | Add CLI parser: `team resume` | code | RP-01 | `src/cli/*` | command available + tests |
| RP-06 | Add CLI parser: `team shutdown` | code | RP-01 | `src/cli/*` | command available + tests |
| RP-07 | Implement `TeamControlPlane` service scaffold | code | RP-01 | `src/team/*`, `src/state/*` | status/resume/shutdown APIs |
| RP-08 | Wire status command to control-plane | code | RP-04, RP-07 | `src/cli`, `src/team` | deterministic status output |
| RP-09 | Wire resume command to control-plane | code | RP-05, RP-07 | `src/cli`, `src/team` | resume lifecycle path works |
| RP-10 | Wire shutdown command to control-plane | code | RP-06, RP-07 | `src/cli`, `src/team/runtime` | graceful+force shutdown works |
| RP-11 | Enforce ACK-before-exec runtime policy | code | RP-02, RP-07 | `src/team/*` | missing ACK fails deterministically |
| RP-12 | Enforce claim/lease validation integration | code | RP-02, RP-07 | `src/state`, `src/team` | claim required for terminal completion |
| RP-13 | Standardize task completion evidence schema | code/docs | RP-02, RP-03 | `src/state`, docs | schema validated in verify |
| RP-14 | Add role-skill mapping registry | code | RP-03 | `src/team`, `extensions/*` | mapping load + validation |
| RP-15 | Add extension skills: team/review/verify/handoff | content | RP-14 | `extensions/oh-my-gemini/skills/*` | skills documented + wired |
| RP-16 | Persist role artifacts and index | code | RP-14 | `src/state`, `src/team` | artifact paths persisted |
| RP-17 | Verify stage reads role artifacts | code/test | RP-13, RP-16 | `src/team/team-orchestrator.ts` | fail on missing required artifacts |
| RP-18 | Add lifecycle command integration tests | test | RP-08, RP-09, RP-10 | `tests/integration/*` | all lifecycle flows covered |
| RP-19 | Add worker protocol reliability tests | test | RP-11, RP-12, RP-13 | `tests/reliability/*` | protocol failures covered |
| RP-20 | Add role contract reliability tests | test | RP-16, RP-17 | `tests/reliability/*` | role contract pass/fail deterministic |
| RP-21 | Add docs snapshot parity tests for CLI help | test | RP-04..RP-06 | `tests/smoke/*` | docs/help drift blocked |
| RP-22 | Namespace migration (`OMG_*` canonical + `OMX_*` compatibility read) | code | RP-11 | `src/team/runtime/*` | dual-read rollout complete |
| RP-23 | Add deprecation guard in CI | ci | RP-22 | `.github/workflows/*`, scripts | release blocked on legacy toggles |
| RP-24 | Replace OmX-dependent live runbook with OmG-native lifecycle | docs/script | RP-10, RP-18 | `docs/testing`, `scripts/*` | runbook fully OmG-native |
| RP-25 | GA cleanup: remove deprecated paths | code/docs | RP-23, RP-24 | cross-cutting | legacy compatibility removed |

---

## 7) Minimal execution ordering suggestion

- **Wave 1 (contract + lifecycle MVP):** RP-01..RP-10
- **Wave 2 (protocol + role contract):** RP-11..RP-17
- **Wave 3 (test + migration + rollout):** RP-18..RP-25

This ordering minimizes merge conflict risk and makes each wave independently verifiable.
