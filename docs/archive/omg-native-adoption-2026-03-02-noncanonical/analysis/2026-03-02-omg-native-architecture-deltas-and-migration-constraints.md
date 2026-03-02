# OmG-Native Architecture Deltas and Migration Constraints

Date: 2026-03-02  
Purpose: translate comparison findings into a concrete OmG target architecture and safe migration boundaries.

---

## 1) Target Outcome

OmG should evolve from:

- **strong orchestrator + durable state + minimal public surface**

into:

- **strong orchestrator + explicit control plane + role/skill contract layer + lifecycle operator commands**

without losing:

- extension-first public UX,
- tmux as default backend,
- current verify/publish gate rigor,
- backward-readable state artifacts.

---

## 2) Current OmG Layer Map

### Existing layers

1. **Public UX**
   - `extensions/oh-my-gemini/**`
   - `src/cli/**`
2. **Orchestrator**
   - `src/team/team-orchestrator.ts`
3. **Runtime adapters**
   - `src/team/runtime/**`
4. **Durable state**
   - `src/state/team-state-store.ts`
5. **Verification**
   - `src/cli/commands/verify.ts`
   - `docs/testing/gates.md`
   - `tests/{smoke,integration,reliability}`

### Current structural weakness

The biggest gap is between **state persistence** and **runtime task semantics**:

- OmG persists tasks/mailbox/worker status,
- but OmG does not yet expose a full control-plane layer that governs task ownership, claim leasing, safe transitions, and operator lifecycle commands.

---

## 3) Proposed New Layers / Modules

## 3.1 New `src/team/contracts.ts`

Introduce explicit OmG team/task invariants:

- safe ID patterns for team/worker/task
- legal task statuses
- legal task transitions
- failure reason taxonomy
- role contract identifiers

Why:

- OmX succeeds partly because contracts are explicit and testable.
- OmG currently spreads some constraints across command parsing and store normalization.

## 3.2 New `src/team/control-plane/` package

Suggested responsibilities:

- `task-lifecycle.ts`
  - `claimTask`
  - `transitionTaskStatus`
  - `releaseTaskClaim`
- `mailbox.ts`
  - append/list/mark-delivered/mark-notified helpers
- `worker-signals.ts`
  - heartbeat/status/idle/done helpers
- `reason-codes.ts`
  - normalized runtime + monitor + task failure reasons

Why:

- separates orchestration policy from raw persistence
- prevents direct file overwrite patterns
- lets CLI/runtime/extension share one lifecycle-safe path

## 3.3 Team CLI expansion

Add command handlers:

- `src/cli/commands/team-status.ts`
- `src/cli/commands/team-resume.ts`
- `src/cli/commands/team-shutdown.ts`

And expand:

- `src/cli/index.ts`
- `docs/omg/commands.md`
- extension command TOMLs under `extensions/oh-my-gemini/commands/team/`

## 3.4 Role contract layer

Suggested new docs/code:

- `docs/architecture/role-skill-contract.md`
- `src/team/role-contracts.ts` (or similar)

Minimum first-wave contracts:

- `planner`
- `executor`
- `verifier`

Each should define:

- required input
- required output artifact
- required evidence fields
- terminal success/failure conditions

## 3.5 Artifact schema for role runs

Recommended artifact root:

```text
.omg/state/team/<team>/artifacts/
  planner/
  executor/
  verifier/
```

Each role artifact should include:

- `summary.md` or `summary.json`
- `evidence[]`
- `acceptanceCriteria[]`
- `status`
- `updatedAt`

This keeps OmG-native evidence in the same durable state family, not as ad hoc temp files.

---

## 4) Runtime Delta Design

## 4.1 tmux backend target behavior

Current tmux backend is pane/process oriented. Target behavior should stay that way, but with stronger bootstrap protocol:

1. worker identity written before work starts
2. worker ACK required
3. task claim required before execution
4. completion report must include verification evidence when relevant
5. idle/done signal written on terminal completion

### Important

Do **not** move task lifecycle logic into pane orchestration code.  
Keep tmux backend responsible for runtime transport/process status; keep task control in control-plane/state layer.

## 4.2 subagents backend target behavior

Current backend is deterministic and effectively synthetic. Migration target:

- retain deterministic scaffolding in early phases,
- add role artifact generation first,
- only later consider true live delegated execution semantics.

This avoids overpromising parity before OmG has the surrounding reliability contracts.

---

## 5) State Schema Migration Constraints

## 5.1 Backward compatibility requirements

Must keep readable:

- `phase.json`
- `monitor-snapshot.json`
- `tasks/task-<id>.json`
- legacy task/mailbox compatibility already promised in `TeamStateStore`

## 5.2 Safe additive fields

Safe additions include:

- `task.claim`
- `task.completedAt`
- `task.updatedBy`
- `task.failureReasonCode`
- `worker.role`
- `snapshot.runtime.reasonCodes`
- artifact references under `snapshot.runtime.artifacts`

## 5.3 Migration anti-patterns to avoid

Do not:

- rename `.omg/state` root,
- rewrite all task IDs into a new shape,
- require new artifacts for old readers without fallback,
- make extension commands depend on new schema before CLI/tests are updated.

---

## 6) Public UX Constraints

OmG should not become “OmX with Gemini labels.”

### Preserve OmG-native UX traits

1. **Extension-first discoverability**
   - public-facing workflows should still be available through extension command/skill surfaces.
2. **Minimal top-level CLI**
   - add only operationally essential commands.
3. **Docs as contract**
   - README stays concise; deeper operational detail remains in docs.
4. **Unified model default for subagents**
   - keep current principle until there is a strong need for per-role model divergence.

---

## 7) Dependency and Rollout Constraints

### Internal dependency order

1. contracts
2. control plane
3. lifecycle CLI
4. role contracts + artifact schema
5. extension skill expansion
6. optional MCP/control-plane exposure

### Why this order matters

Adding user-visible skills or commands before lifecycle correctness will create false-green UX and support burden.

---

## 8) Recommended File-Level Implementation Map

### Likely code touch set

- `src/cli/index.ts`
- `src/cli/commands/team-run.ts`
- `src/team/team-orchestrator.ts`
- `src/state/team-state-store.ts`
- `src/team/runtime/tmux-backend.ts`
- `src/team/runtime/subagents-backend.ts`
- new: `src/team/contracts.ts`
- new: `src/team/control-plane/*`

### Likely docs touch set

- `docs/omg/commands.md`
- `docs/architecture/runtime-backend.md`
- `docs/architecture/state-schema.md`
- `docs/testing/gates.md`
- `docs/testing/live-team-e2e.md`
- new: `docs/architecture/role-skill-contract.md`

### Likely test touch set

- `tests/reliability/*task*`
- `tests/reliability/*team*`
- `tests/integration/team-lifecycle.test.ts`
- new control-plane lifecycle tests

---

## 9) Definition of Architectural Success

The architecture migration is successful when all are true:

1. OmG still feels like an extension-first Gemini product.
2. Team runtime now has explicit control-plane semantics comparable in rigor to OmX.
3. Role selection produces contract-bound artifacts, not just selection metadata.
4. CI can prove lifecycle correctness, not just happy-path invocation.
5. Existing state consumers/docs/scripts continue to work or fail with explicit migration guidance.
