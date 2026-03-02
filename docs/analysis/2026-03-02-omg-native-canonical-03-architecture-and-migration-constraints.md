# OmG-Native Canonical 03 — Target Architecture and Migration Constraints

Status: **Canonical (authoritative)**  
Date: 2026-03-02

## 1) Target architecture (normative)

```text
CLI + Extension command surface
  -> Team Control Plane (new)
     - claim / transition / release
     - mailbox lifecycle helpers
     - worker protocol guardrails
  -> Team Orchestrator (existing, strengthened)
     - plan -> execute -> verify -> fix -> complete/fail
  -> Runtime backends
     - tmux (default production path)
     - subagents (opt-in, staged truthfulness)
  -> TeamStateStore (durable state)
  -> Verify + CI gate layer (C0..C7)
```

## 2) Required implementation surfaces

1. `src/team/control-plane/*` (new)
2. `src/team/contracts.ts` (new/expanded)
3. `src/team/team-orchestrator.ts` (integration of control-plane + protocol checks)
4. `src/cli/index.ts` + team command handlers (status/resume/shutdown)
5. extension command/skill definitions under `extensions/oh-my-gemini/*`
6. state schema/documentation updates (`docs/architecture/state-schema.md` and canonical docs)

## 3) State and protocol constraints (hard)

1. Keep additive schema evolution; preserve read compatibility for existing task/mailbox artifacts.
2. Keep canonical task path format (`tasks/task-<id>.json`) stable.
3. Enforce claim-token semantics for lifecycle status transitions.
4. Preserve tmux runtime default and stable worker-count defaults.
5. Keep subagents as opt-in until PR-RT-01 evidence threshold is met.
6. All new lifecycle behavior must be represented in docs/help/extension prompts in same wave.

## 4) Migration anti-patterns (forbidden)

- Direct raw writes to lifecycle fields bypassing control-plane APIs.
- Shipping lifecycle CLI without compatible docs/help and tests.
- Expanding role catalog breadth before role schema v1 is enforced.
- Using legacy bypass toggles to satisfy release-quality claims.

## 5) Architectural success criteria

Architecture is considered complete when:

1. lifecycle mutations are control-plane mediated,
2. operator lifecycle commands are first-class and test-backed,
3. role execution produces schema-valid durable evidence,
4. compatibility + rollout constraints are enforced by blocking gates.
