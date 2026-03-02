# OmG-native Adoption Briefing Pack for ralplan (2026-03-02)

## Purpose

This file is the entrypoint for the OmG-native adoption program:

- adopt OmC/OmX strengths in **team orchestration** and **role/skill execution**,
- keep OmG identity (**extension-first**, **tmux-default**, **verify-gated**, **deterministic state**),
- provide a direct handoff package for `/ralplan` decomposition and execution.

---

## Recommended Reading Order (Canonical)

1. **Master synthesis (primary)**
   - `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md`
2. **Capability delta matrix**
   - `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md`
3. **Architecture deltas + constraints**
   - `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md`
4. **Phased execution plan**
   - `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md`
5. **Acceptance + CI gates**
   - `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md`
6. **ralplan-ready task graph**
   - `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`
7. **Risk/rollout + task/ring strategy**
   - `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md`

---

## Core Deltas to Execute (Program Summary)

## D1. Lifecycle CLI parity (OmG-native)

Add:

- `omg team status`
- `omg team resume`
- `omg team shutdown`

while preserving `omg team run` compatibility.

## D2. Control-plane rigor (OmX-style semantics in OmG architecture)

Introduce first-class APIs + contracts:

- claim task (token + lease)
- transition task status (guarded by claim token)
- release claim
- deterministic conflict/failure taxonomy

## D3. Worker protocol standardization (tmux path)

Enforce worker lifecycle:

1. ACK
2. claim
3. execute
4. evidence write
5. status idle/fail

## D4. Role->Skill->Evidence contract

Role selection must produce schema-valid artifacts and verification evidence.

Minimum initial role band:

- planner
- executor
- verifier

Minimum skill band:

- execute
- review
- verify
- handoff

## D5. Gate expansion (preserve OmG quality posture)

Keep C0/C1/C2 and add blocking gates for:

- lifecycle commands,
- control-plane mutation semantics,
- role contract integrity,
- docs/command contract drift.

---

## ralplan Input Pack (Task Seed)

Use these as initial tracks:

- **Track A (Control Plane):** T01-T07
- **Track B (Lifecycle CLI):** T08-T11
- **Track C (Worker Protocol):** T12-T15
- **Track D (Role/Skill Contracts):** T16-T20
- **Track E (Gate + Release Readiness):** T21-T25

Reference source:

- `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`

---

## Full Artifact Inventory Produced in This Cycle

### Analysis docs

- `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md`
- `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md`
- `docs/analysis/2026-03-02-omg-native-architecture-deltas-and-migration-constraints.md`
- `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md`
- `docs/analysis/2026-03-02-omg-omc-omx-capability-delta-matrix.md`
- `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md`
- `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md`
- `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md`
- `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md`

### Planning docs

- `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md`
- `docs/planning/2026-03-02-omg-native-acceptance-and-ci-gates.md`
- `docs/planning/2026-03-02-omg-native-phased-execution-plan.md`
- `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md`
- `docs/planning/2026-03-02-omg-native-risk-register-rollout-and-ralplan-tasks.md`
- `docs/planning/2026-03-02-omg-native-risk-register-rollout.md`
- `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`
- `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-2.md`
- `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md`
- `docs/planning/2026-03-02-omg-native-omc-omx-master-synthesis-worker-6.md`
- `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md`
- `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md`
- `docs/planning/2026-03-02-omg-native-orchestration-role-skill-master-synthesis-worker-5.md`
- `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md`

---

## Program Exit Criteria (for this planning cycle)

Planning is considered complete when:

1. canonical docs above are approved,
2. ralplan decomposition baseline is accepted,
3. first execution batch (T01/T02/T08/T21 seed) is queued.

