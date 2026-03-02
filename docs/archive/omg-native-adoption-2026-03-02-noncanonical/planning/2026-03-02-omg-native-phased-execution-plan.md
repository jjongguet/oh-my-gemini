# OmG-Native Phased Execution Plan

Date: 2026-03-02  
Purpose: phased plan for adopting OmC/OmX orchestration + role/skill capabilities in OmG-native form.

---

## 1) Planning Principles

1. **Stabilize control plane before broadening UX.**
2. **Add role contracts before adding many new skills.**
3. **Ship additive, backward-readable state changes only.**
4. **Use CI gates as release blockers, not documentation promises.**

---

## 2) Phase Overview

| Phase | Goal | Primary Output | Exit Condition |
|---|---|---|---|
| 0 | Design lock + invariants | docs + contract decisions | architecture and migration decisions frozen |
| 1 | Control-plane foundation | task lifecycle APIs + tests | claim/transition/release semantics proven |
| 2 | Lifecycle CLI parity | `team status/resume/shutdown` | operator lifecycle fully testable |
| 3 | Role contract execution | planner/executor/verifier artifacts | role selection has meaningful output contracts |
| 4 | Extension skill expansion | team/review/verify/handoff skills | user-facing role workflow is extension-accessible |
| 5 | Reliability + rollout hardening | CI gates, docs, canary process | canary/beta/GA criteria met |

---

## 3) Detailed Phase Plan

## Phase 0 — Design Lock

### Scope

- finalize OmG-native invariants
- finalize task lifecycle transition matrix
- finalize role contract v1 (`planner/executor/verifier`)

### Deliverables

- architecture docs updated
- state schema addendum approved
- role contract draft approved

### Acceptance criteria

- no open ambiguity on task state transitions
- no open ambiguity on command syntax for lifecycle commands
- no open ambiguity on artifact locations for role outputs

---

## Phase 1 — Control-Plane Foundation

### Scope

Implement lifecycle-safe task operations above `TeamStateStore`:

- claim
- transition
- release
- mailbox delivery acknowledgment helpers
- worker heartbeat/status helper utilities

### Code targets

- new `src/team/contracts.ts`
- new `src/team/control-plane/*`
- integrate with `src/team/team-orchestrator.ts`
- minimal `TeamStateStore` changes only where needed

### Acceptance criteria

- claim conflict is deterministic
- illegal transitions are rejected deterministically
- expired lease path is test-covered
- task lifecycle mutations no longer rely on raw task file overwrites in new code paths

### Verification

- reliability tests for claim/transition/release
- state schema compatibility tests
- integration run still passes existing `team run`

---

## Phase 2 — Lifecycle CLI Parity

### Scope

Add:

- `omg team status`
- `omg team resume`
- `omg team shutdown`

### Code targets

- new CLI handlers
- updated `src/cli/index.ts`
- updated extension command TOMLs
- updated docs and runbooks

### Acceptance criteria

- status reports phase, worker health, task counts, runtime summary
- resume safely reattaches to resumable team state or fails with actionable reason
- shutdown supports safe and force modes
- exit codes follow OmG CLI conventions (`0` success, `2` usage/config error, `1` runtime failure)

### Verification

- unit coverage for parsing and usage errors
- integration coverage for status/resume/shutdown lifecycle
- optional live e2e smoke updated to exercise new commands

---

## Phase 3 — Role Contract Execution

### Scope

Move from “role selected” to “role produced valid artifact” for:

- planner
- executor
- verifier

### Artifact contract

- planner: decomposition + acceptance criteria + dependencies
- executor: implementation/output summary + changed area references
- verifier: PASS/FAIL evidence + regression callout

### Acceptance criteria

- subagent selection persists role ids and output artifact paths
- role artifact validation fails when required fields are missing
- orchestrator/runtime can surface role failure as actionable run failure

### Verification

- new reliability tests for artifact validation
- integration test for role-tagged task run
- docs/examples aligned with actual generated artifact structure

---

## Phase 4 — Extension Skill Expansion

### Scope

Add minimal OmG-native skill pack:

- `team`
- `review`
- `verify`
- `handoff`

These must map to runtime/control-plane concepts, not free-form prompts only.

### Acceptance criteria

- each skill references a stable runtime/verification contract
- each skill produces or consumes durable state/artifact locations
- extension docs explain when to use `plan` vs `team` vs `verify` etc.

### Verification

- extension command/skill smoke tests
- docs/examples validated against current CLI contracts

---

## Phase 5 — Reliability and Rollout Hardening

### Scope

- retire or tightly gate legacy compatibility flags
- add reason-code taxonomy for failures
- add canary/beta/GA rollout policy
- update CI and release workflows if new blocking gates are required

### Acceptance criteria

- no silent green path through legacy bypasses in release pipeline
- lifecycle/role contract regressions are caught pre-release
- rollback instructions are documented and tested at least once in canary

### Verification

- full `npm run verify`
- live/operator signal runbook refreshed
- release workflow docs remain aligned with reality

---

## 4) Recommended Sequencing by Week

### Week 1

- Phase 0 completion
- Phase 1 implementation start
- control-plane contract tests first

### Week 2

- finish Phase 1
- land Phase 2 CLI parity
- wire docs and integration tests

### Week 3

- Phase 3 role contracts
- planner/executor/verifier artifact validation

### Week 4

- Phase 4 extension skill expansion
- Phase 5 canary hardening

---

## 5) Parallelization Opportunities

### Safe parallel workstreams

- docs updates after command/contract interfaces freeze
- extension TOML/skill work after role contracts freeze
- reliability tests can proceed in parallel with CLI handlers once API shape is stable

### Unsafe parallel workstreams

- changing task schema and role artifact schema independently
- adding resume/shutdown before control-plane lifecycle semantics are settled
- expanding skill surface before role outputs are validated

---

## 6) Phase-Level Done Definition

A phase is done only when all apply:

1. code landed,
2. docs updated,
3. tests added/updated,
4. verification commands recorded,
5. no conflicting contract remains in README/docs/help/extension prompts.
