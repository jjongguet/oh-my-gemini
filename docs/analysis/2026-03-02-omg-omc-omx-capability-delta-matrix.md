# OMP-native Adoption Delta Matrix (OMP vs OmX vs OmC)

Date: 2026-03-02  
Audience: oh-my-product maintainers  
Intent: identify concrete, implementation-level deltas required for `oh-my-product` (OMP) to adopt proven OmX/OmC orchestration + role/skill capabilities **without losing OMP’s extension-first identity**.

---

## 1) Evidence Snapshot (local code, same-day)

### 1.1 OMP (this repository)

- CLI command dispatch and team subcommand surface:
  - `src/cli/index.ts` (only `team run` is accepted, no status/resume/shutdown)
- Team run options and subagent parsing:
  - `src/cli/commands/team-run.ts`
- Runtime backend contract + implementations:
  - `src/team/runtime/runtime-backend.ts`
  - `src/team/runtime/tmux-backend.ts`
  - `src/team/runtime/subagents-backend.ts`
- Orchestrator success checklist and verify gate:
  - `src/team/team-orchestrator.ts`
- State mutation layer:
  - `src/state/team-state-store.ts`
  - `src/state/filesystem.ts`

### 1.2 OmX reference snapshot

- Team lifecycle CLI (`status`, `resume`, `shutdown`):
  - `.omx/tmp/oh-my-codex/src/cli/team.ts`
- Claim/lease/transition/release task lifecycle:
  - `.omx/tmp/oh-my-codex/src/team/state.ts`
- MCP state tool contracts for lifecycle-safe mutation:
  - `.omx/tmp/oh-my-codex/src/mcp/state-server.ts`
- Worker protocol requiring state API claim:
  - `.omx/tmp/oh-my-codex/src/team/worker-bootstrap.ts`

### 1.3 OmC reference snapshot

- Team runtime start/monitor/shutdown/resume:
  - `.omx/tmp/oh-my-claudecode/src/team/runtime.ts`
- Atomic claim lock implementation (`O_EXCL`, stale lock handling):
  - `.omx/tmp/oh-my-claudecode/src/team/task-file-ops.ts`
- Durable write helper with file+directory fsync:
  - `.omx/tmp/oh-my-claudecode/src/lib/atomic-write.ts`

---

## 2) High-Level Product Surface Delta

| Dimension | OMP current | OmX reference | OmC reference | Delta required for OMP |
|---|---|---|---|---|
| Top-level CLI command breadth | Narrow (5 dispatcher cases) | Medium-wide (15 switch cases) | Wide (24 commander registrations) | Add only orchestration-critical verbs, not full breadth copy |
| Team lifecycle operator verbs | `team run` only | `team status`, `team resume`, `team shutdown` present | Runtime functions support start/monitor/resume/shutdown | Add lifecycle verbs as first-class OMP CLI/API |
| Role/skill surface | Extension skills: `plan` only | ~30 skills + 29 role prompts | ~36 skills + 21 agent prompts | Ship minimal “core orchestration role-pack” first |
| Task lifecycle safety | CAS-style `writeTask(expectedVersion)`; no first-class claim transition API in OMP code | Claim token + lease + transition + release | Atomic lock claiming and guarded task updates | Introduce control-plane lifecycle API in OMP state layer |
| Runtime depth | tmux backend boots commands; subagents backend deterministic-completed snapshot | Runtime+state integrated with worker claims and monitor loops | Runtime orchestrator + worker health + task ops | Deepen runtime/data-plane integration, keep backend abstraction |

---

## 3) Concrete Technical Deltas

## 3.1 CLI & Operator Control Plane

### As-is (OMP)

- `team` subcommand hard-rejects anything except `run` (`src/cli/index.ts`).
- No native OMP command path for status polling, resumability, or graceful shutdown.

### Target delta

Add:

- `omp team status --team <name> [--json]`
- `omp team resume --team <name> [--json]`
- `omp team shutdown --team <name> [--force] [--json]`

### Why this is OMP-native

- Keeps OMP’s explicit CLI architecture and typed command modules.
- Improves operability without importing OmX/OmC command sprawl.

---

## 3.2 Task Lifecycle Mutation Semantics

### As-is (OMP)

- `TeamStateStore.writeTask()` supports optimistic CAS (`expectedVersion`) and monotonic versions.
- But OMP code currently lacks first-class mutation methods equivalent to:
  - claim (with lease)
  - claim-safe status transition
  - explicit claim release

### Reference strength (OmX)

- `claimTask`, `transitionTaskStatus`, `releaseTaskClaim` with locking + lease expiry enforcement.
- MCP tools enforce lifecycle discipline (`team_update_task` cannot mutate lifecycle fields directly).

### Target delta

In OMP, add state/control-plane APIs:

1. `claimTask(team, taskId, worker, expectedVersion?)`
2. `transitionTaskStatus(team, taskId, from, to, claimToken)`
3. `releaseTaskClaim(team, taskId, claimToken, worker)`

…and wire these into worker protocol and orchestration logic.

---

## 3.3 Runtime Behavior Gap (tmux + subagents)

### As-is (OMP)

- tmux default worker command falls back to a minimal bootstrap print (`printf '[oh-my-product] tmux runtime started\n'`).
- subagents backend monitor currently emits deterministic `completed` with all workers marked `done` once started.

### Delta

- tmux path must support real task dispatch + worker completion signals.
- subagents path must evolve from deterministic snapshot to actual role-scoped execution traces and completion evidence.

### OMP-native constraint

- Keep tmux as default runtime backend.
- Keep subagents opt-in until parity evidence reaches reliability threshold.

---

## 3.4 Worker Bootstrap Protocol

### Reference pattern

OmX worker overlay requires:

- ACK to leader,
- canonical team state root resolution,
- numeric task id normalization,
- claim via state API before work,
- structured completion writes.

### OMP delta

Introduce a first-class OMP worker protocol template (with equivalent invariants) and persist it per worker under `.omp/state/team/<team>/workers/<worker>/inbox.md`.

---

## 3.5 Role/Skill Capability Gap

### As-is (OMP)

- Role catalog exists and is strong (default subagent blueprint).
- Extension skill surface is very small (currently `plan` only).

### Delta

Introduce an OMP core role/skill bundle:

- `team` (operational lifecycle),
- `execute`,
- `review`,
- `verify`,
- `handoff`.

These should map directly to persisted artifacts and verification outputs.

---

## 3.6 State Durability & Locking

### As-is (OMP)

- Atomic temp+rename writes exist in filesystem helper.
- No explicit file+directory fsync durability guarantees.
- No cross-process claim lock primitive in OMP code today.

### Reference pattern

- OmC’s atomic write utility performs fsync on file and best-effort dir fsync.
- OmC/OmX include task-claim lock handling and stale lock recovery.

### Delta

For OMP state writes involving orchestration-critical lifecycle fields:

- add optional durable-write mode (fsync),
- add claim lock primitives for cross-process coordination,
- keep existing simple write path for low-risk metadata files.

---

## 3.7 Test/CI Delta

### As-is

OMP has strong release-gate discipline (`gate:global-install-contract`, `gate:publish`, verify suites), but lacks dedicated gates for claim/transition lifecycle parity.

### Delta

Add a dedicated “team control-plane contract gate” to CI:

- claim conflict,
- blocked dependency enforcement,
- invalid transition rejection,
- lease expiry rejection,
- claim release rollback semantics.

---

## 4) Adopt / Adapt / Avoid Matrix

| Capability from OmX/OmC | Decision for OMP | Rationale |
|---|---|---|
| `team status/resume/shutdown` operator verbs | **Adopt** | Mandatory for production operability |
| Claim-token task lifecycle API | **Adopt** | Required for concurrency safety and deterministic worker behavior |
| Strict lifecycle mutation separation | **Adopt** | Prevents silent state corruption and false-green completions |
| Massive skill catalog surface immediately | **Avoid (initially)** | Violates OMP’s lean extension-first posture |
| Role/skill-output contracts | **Adapt** | Keep role breadth small, enforce stronger evidence schema |
| Aggressive flag-heavy launch UX (`madmax` style patterns) | **Avoid** | Not aligned with OMP trust posture and simplicity goals |
| Atomic writes with fsync for critical files | **Adapt** | Apply selectively to orchestration-critical artifacts |
| Deterministic fake-completion subagent path | **Retire over time** | Useful for bootstrap, but cannot remain production default proof |

---

## 5) Bottom Line

OMP already has the right abstraction seams (runtime backend contract, orchestrator phase model, persisted state tree, verify gates).  
What it lacks vs OmX/OmC is not architecture intent, but **control-plane depth and role/skill execution contract strength**.

The shortest path is:

1. add lifecycle commands,
2. add claim/transition/release APIs,
3. harden worker protocol + real runtime evidence,
4. expand role/skill surface in a minimal, OMP-native way,
5. lock all of it behind CI contract gates.

