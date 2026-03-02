# OmG-native Canonical C4 — Target Architecture and Migration Constraints

Date: 2026-03-02  
Status: Authoritative

---

## 1) Target architecture

```text
CLI + extension command surface
  -> Team control plane (new)
     - claim / transition / release
     - mailbox lifecycle helpers
     - worker protocol guardrails
  -> Team orchestrator (existing, strengthened)
     - plan -> exec -> verify -> fix -> completed|failed
  -> Runtime backends
     - tmux (default)
     - subagents (opt-in, staged realism)
  -> TeamStateStore (durable state)
  -> Verify + CI gate layer (C0..C7)
```

---

## 2) Required code surfaces

1. `src/team/contracts.ts`
   - legal task statuses/transitions
   - reason codes
   - identifier validation
2. `src/team/control-plane/*`
   - `claimTask`
   - `transitionTaskStatus`
   - `releaseTaskClaim`
   - mailbox helpers
3. `src/team/team-orchestrator.ts`
   - success checklist must include control-plane and artifact truth
4. `src/cli/index.ts` + new team command handlers
5. `extensions/oh-my-gemini/commands/team/*` and `extensions/oh-my-gemini/skills/*`
6. `docs/architecture/state-schema.md`, `docs/testing/gates.md`, `docs/testing/live-team-e2e.md`

---

## 3) Canonical state and artifact constraints

1. Keep `.omg/state/team/<team>/...` as canonical state root.
2. Keep `tasks/task-<id>.json` as canonical task path.
3. Keep mailbox compatibility reads, but standardize canonical writes through one documented path.
4. Introduce durable artifact paths under `.omg/state/team/<team>/artifacts/{planner,executor,verifier}/`.
5. Additive schema evolution only; old readers must continue working during migration.

---

## 4) Runtime constraints

1. tmux remains default runtime and production path.
2. Worker transport logic stays in runtime backends; lifecycle policy stays in control plane.
3. subagents remain opt-in until role artifact + evidence truthfulness is proven by gates.
4. completion cannot rely on synthetic runtime status alone.

---

## 5) Forbidden migration anti-patterns

- shipping lifecycle CLI without control-plane invariants,
- bypassing control-plane APIs with raw lifecycle writes,
- expanding role/skill breadth before schema v1 is enforced,
- changing canonical state roots or task-id shape,
- using legacy bypass toggles to claim release readiness.

---

## 6) Architectural success criteria

Architecture is complete when:

1. control-plane APIs own lifecycle mutation,
2. lifecycle commands are first-class and test-backed,
3. role artifacts are durable and schema-valid,
4. docs/help/prompts match implemented behavior,
5. rollout constraints are protected by blocking gates.
