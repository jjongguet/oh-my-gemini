<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-03T07:46:00Z | Updated: 2026-03-03T07:46:00Z -->

# control-plane

## Purpose
Core control-plane primitives for the team orchestration system. Manages task lifecycle state machines, worker mailbox protocols, failure taxonomy, and deterministic identifier generation. These modules form the coordination backbone that the team orchestrator and runtime backends rely on.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Barrel export for all control-plane primitives. |
| `task-lifecycle.ts` | Task state machine: transitions tasks through pending → in_progress → completed/failed. Enforces valid state transition rules. |
| `mailbox-lifecycle.ts` | Worker mailbox open/close/drain lifecycle. Coordinates message delivery between orchestrator and workers. |
| `failure-taxonomy.ts` | Typed failure category enum and helpers. Classifies errors (timeout, crash, capacity, etc.) for structured error reporting. |
| `identifiers.ts` | Deterministic, filesystem-safe ID generation for teams, workers, and tasks. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep these modules pure and free of side effects where possible.
- State transitions must be deterministic and logged.
- Failure taxonomy changes require updating downstream consumers in `team-orchestrator.ts`.

### Testing Requirements
- Changes here must pass `npm run test:reliability` — reliability tests heavily exercise control-plane contracts.
- Add or update tests in `tests/reliability/team-control-plane.test.ts` for new transitions.

### Common Patterns
- State machine pattern: explicit allowed transitions, throw on invalid.
- All IDs are generated via `identifiers.ts` — do not construct raw strings elsewhere.

## Dependencies

### Internal
- Used by `src/team/team-orchestrator.ts`, `src/team/runtime/`, and `src/state/`.

### External
- Node.js `crypto` (for ID generation).

<!-- MANUAL: -->
- Pre-assignment flow: the orchestrator pre-claims tasks via `TaskControlPlane.claimTask()` in `preClaimTasksForWorkers()` before runtime start, then passes `{ taskId, claimToken }` to each worker via `TeamStartInput.taskClaims`.
- Tmux worker launch injects the claim as env vars (`OMG_WORKER_TASK_ID`, `OMG_WORKER_CLAIM_TOKEN`), so worker processes start with an existing claim token instead of claiming in-process.
- Worker-side lifecycle updates must call `transitionTaskStatus()` (and `releaseTaskClaim()` when needed), never `claimTask()`, to avoid cross-process optimistic-concurrency races on task version/claim ownership.
- `TaskClaimEntry` contract is defined in `src/team/types.ts` as `{ taskId: string; claimToken: string }`, keyed by worker id in `TeamStartInput.taskClaims`.
