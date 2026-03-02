# OmG-native Target Architecture and Migration Constraints

Date: 2026-03-02  
Canonical ID: C4  
Depends on: C2, C3

---

## 1) Target architecture outcome

Evolve OmG from:

- orchestrator + durable state + minimal lifecycle command surface

to:

- orchestrator + explicit control plane + enforced worker protocol + role/skill artifact contracts

while preserving extension-first UX and tmux-default runtime.

---

## 2) Canonical layer model

| Layer | Responsibility | Boundary rule |
|---|---|---|
| Public UX layer (`extensions/**`, `src/cli/**`) | Operator and extension command surfaces | Must not implement lifecycle mutation logic directly |
| Orchestrator layer (`src/team/team-orchestrator.ts`) | Phase progression and high-level run control | Must call control-plane APIs for lifecycle mutation |
| Control-plane layer (new/expanded `src/team/control-plane/**`) | claim/transition/release, mailbox lifecycle, worker signals | Sole canonical mutation path for lifecycle fields |
| Runtime layer (`src/team/runtime/**`) | tmux/subagents transport/execution handling | Must not bypass control-plane invariants |
| Durable state layer (`src/state/**`) | atomic persistence and compatibility reads | Must preserve path/schema compatibility guarantees |
| Verification/gate layer (`src/cli/commands/verify.ts`, tests, CI workflows) | prove integrity and release readiness | Must block false-green and bypass behavior |

---

## 3) Control-plane API contract (canonical)

Recommended signatures (conceptual):

```ts
claimTask(team: string, taskId: string, worker: string, opts?: { expectedVersion?: number; leaseMs?: number }): ClaimResult
transitionTaskStatus(team: string, taskId: string, from: TaskStatus, to: TaskStatus, claimToken: string): TransitionResult
releaseTaskClaim(team: string, taskId: string, claimToken: string, worker?: string): ReleaseResult
```

Mandatory semantics:

1. claim returns token + lease metadata,
2. transition validates legal edge and claim ownership/lease validity,
3. dependency-blocked tasks are non-claimable,
4. release is deterministic under valid ownership,
5. failure reasons use normalized reason-code taxonomy.

---

## 4) Worker protocol contract (canonical)

Required sequence:

1. identity/bootstrap context resolved,
2. ACK sent,
3. claim acquired,
4. execute task,
5. write structured result/evidence,
6. write terminal worker status (`idle`/`blocked`/`failed`).

Hard rules:

- no claim -> no in-progress work,
- no structured result -> no completion,
- no terminal status write -> protocol failure.

---

## 5) Role-to-skill-to-artifact contract

### 5.1 Role baseline

Required roles: `planner`, `executor`, `verifier`  
Optional role: `reviewer`

### 5.2 Artifact path baseline

```text
.omg/state/team/<team>/artifacts/
  planner/
  executor/
  verifier/
```

### 5.3 Minimum artifact contract

| Field | Requirement |
|---|---|
| `role` | required |
| `status` | required (`pass`/`fail` or equivalent canonical enum) |
| `summary` | required |
| `evidence[]` | required |
| `updatedAt` | required ISO timestamp |
| `acceptanceCriteria[]` | required for planner/verifier |

---

## 6) Migration constraints (non-negotiable)

| ID | Constraint |
|---|---|
| MC-01 | `.omg/state` root must remain canonical (no re-root in this cycle). |
| MC-02 | Existing readable artifacts (`phase.json`, `monitor-snapshot.json`, `tasks/task-<id>.json`) must remain backward-readable. |
| MC-03 | Schema evolution must be additive first; do not require full re-write migration for existing teams. |
| MC-04 | `team run` compatibility must be preserved while new lifecycle commands are introduced. |
| MC-05 | `tmux` default and `subagents` opt-in policy must remain intact. |
| MC-06 | Extension prompts/docs/help and CLI surfaces must ship in sync for lifecycle changes. |
| MC-07 | Legacy compatibility shortcuts may exist temporarily but must be auditable and release-gated (see C7). |

---

## 7) Anti-patterns to reject

1. Directly mutating task lifecycle fields from CLI/runtime glue code.
2. Embedding control-plane logic in tmux transport code.
3. Declaring role support without enforceable artifact contracts.
4. Treating synthetic backend completion as sufficient success evidence.
5. Shipping lifecycle commands without docs/help/prompt parity updates.

---

## 8) File-level implementation map

### 8.1 Expected code touch families

- `src/team/control-plane/**` (new/expanded)
- `src/team/contracts.ts` (new/expanded)
- `src/team/team-orchestrator.ts`
- `src/team/runtime/tmux-backend.ts`
- `src/team/runtime/subagents-backend.ts`
- `src/state/team-state-store.ts`
- `src/cli/index.ts`
- `src/cli/commands/team-*.ts`

### 8.2 Expected docs/test touch families

- `docs/omg/commands.md`
- `docs/architecture/state-schema.md`
- `docs/architecture/runtime-backend.md`
- `docs/architecture/role-skill-contract.md` (canonical target)
- `docs/testing/gates.md`
- `tests/reliability/**` (claim/transition/release/protocol)
- `tests/integration/**` (status/resume/shutdown)

---

## 9) Architectural success criteria

Architecture migration is complete when all are true:

1. lifecycle mutation safety is centralized and test-proven,
2. operator lifecycle commands are production-usable,
3. worker protocol is runtime-enforced,
4. role outputs are artifact-truthful and verifier-binding,
5. compatibility guarantees remain intact,
6. release gates can block unsafe bypass or false-green outcomes.

