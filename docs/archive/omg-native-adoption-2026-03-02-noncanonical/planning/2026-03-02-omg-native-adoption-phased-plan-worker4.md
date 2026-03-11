# OmG-native Adoption Phased Execution Plan (OmC/OmX Orchestration + Role/Skill)

_Date: 2026-03-02_  
_Companion docs:_
- `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md`

## Phase 0 — Decision Lock (Architecture + Contracts)

**Objective**

Freeze migration principles before implementation drift begins.

**Scope**

- Confirm extension-first + tmux-default + subagents-opt-in invariants.
- Lock control-plane boundary and ownership.
- Approve failure taxonomy and unsafe-mode policy.

**Deliverables**

- Master synthesis accepted.
- RFC-level delta map approved.
- Acceptance criteria and rollout policy accepted.

**Exit criteria**

- No open ambiguity on:
  - lifecycle command surface,
  - task claim/transition semantics,
  - role-to-skill contract owner.

---

## Phase 1 — Control-plane Foundations (P0)

**Objective**

Turn state schema fields into enforceable runtime behavior.

**Implementation scope**

- Add control-plane task APIs:
  - claim with lease,
  - transition with claim token,
  - release claim,
  - clear transition validation errors.
- Add mailbox lifecycle APIs:
  - send/list,
  - mark notified,
  - mark delivered.

**Primary code targets**

- `src/state/team-state-store.ts` (or new state adapters)
- `src/team/control-plane/*` (new)
- `src/state/types.ts`

**Required tests**

- reliability:
  - claim contention,
  - lease expiry,
  - invalid transition rejection,
  - CAS mismatch enforcement,
  - mailbox dedupe semantics.

**Exit criteria**

- control-plane APIs are consumed by orchestrator path (not dead code),
- deterministic failure reasons are persisted.

---

## Phase 2 — Lifecycle CLI Parity (P0)

**Objective**

Add operational control parity without abandoning OmG UX conventions.

**Implementation scope**

- New subcommands:
  - `omg team status`
  - `omg team resume`
  - `omg team shutdown`
- Preserve `team run` behavior and output compatibility.

**Primary code targets**

- `src/cli/index.ts`
- `src/cli/commands/team-*.ts` (new handlers)
- `docs/omg/commands.md`

**Required tests**

- CLI contract tests for usage/exit codes/json outputs,
- integration tests for start->status->shutdown,
- resume tests for interrupted runs.

**Exit criteria**

- operator can manage a team lifecycle without using external `omx team` commands.

---

## Phase 3 — Worker Protocol Enforcement for tmux Runtime (P0/P1)

**Objective**

Make tmux workers protocol-correct, not only pane-alive.

**Implementation scope**

- Worker bootstrap contract:
  - identity validation,
  - startup ACK,
  - claim-before-work,
  - completion payload,
  - terminal status write (`idle|blocked|failed`).
- Monitor/orchestrator must treat protocol violations as failures.

**Primary code targets**

- `src/team/runtime/tmux-backend.ts`
- `src/team/team-orchestrator.ts`
- protocol templates under extension/docs if introduced.

**Required tests**

- reliability tests for missing ACK, missing claim, stale heartbeats,
- integration test proving end-to-end worker protocol pass.

**Exit criteria**

- a run cannot pass if worker protocol evidence is incomplete.

---

## Phase 4 — Role/Skill Contract Realization (P1)

**Objective**

Convert role routing into outcome-producing execution contracts.

**Implementation scope**

- Define role-to-skill mapping contract (versioned schema).
- Extend extension skill catalog beyond `plan`:
  - `team`
  - `execute`
  - `review`
  - `verify`
  - `handoff`
- Add role-specific evidence expectations in output artifacts.

**Primary code/doc targets**

- `src/team/subagents-catalog.ts`
- `skills/*`
- `docs/architecture/*` (new role-skill contract doc)

**Required tests**

- parser and mapping tests,
- integration tests validating role-tag to artifact mapping,
- verify report tests for role evidence presence.

**Exit criteria**

- selected roles produce predictable, validated artifacts.

---

## Phase 5 — Reliability Hardening + Verify/Gate Integration (P1/P2)

**Objective**

Bind new orchestration capabilities to release-grade proof.

**Implementation scope**

- Extend `omg verify` to include orchestration parity checks (or add dedicated suites invoked by `verify`).
- Update gate definitions in `docs/testing/gates.md` and scripts.
- Block release when legacy bypass flags are enabled.

**Required commands baseline**

- `npm run typecheck`
- `npm run test:smoke`
- `npm run test:integration`
- `npm run test:reliability`
- `npm run verify -- --json`
- `npm run gate:publish`

**Exit criteria**

- new control-plane + lifecycle guarantees are enforced by CI, not convention.

---

## Phase 6 — Rollout + Deprecation Completion (P2)

**Objective**

Move from experimental to default with safe rollback.

**Implementation scope**

- staged flag rollout:
  - experimental,
  - opt-in beta,
  - default-on,
  - cleanup/deprecation.
- document migration and troubleshooting.

**Exit criteria**

- default experience uses new lifecycle/control-plane path,
- rollback is scriptable and tested,
- deprecated compatibility paths are removed from release workflows.

---

## Cross-phase Acceptance Matrix

| Capability | Required by phase |
|---|---|
| Team lifecycle command parity | Phase 2 |
| Control-plane task semantics | Phase 1 |
| Worker bootstrap protocol | Phase 3 |
| Role-to-skill contract | Phase 4 |
| CI enforcement | Phase 5 |
| Safe default rollout | Phase 6 |

---

## Suggested milestone ordering (minimal-risk)

1. Phase 0 lock
2. Phase 1 control-plane core
3. Phase 2 lifecycle CLI
4. Phase 3 worker protocol
5. Phase 5 reliability gating
6. Phase 4 role/skill expansion
7. Phase 6 rollout

Reasoning: correctness + operational safety before UX breadth expansion.
