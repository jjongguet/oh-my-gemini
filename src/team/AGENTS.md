<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-03T07:46:00Z -->

# team

## Purpose
Contains orchestration domain logic: lifecycle management, health monitoring, runtime backend integration, and subagent catalog/blueprint support.

## Key Files

| File | Description |
|------|-------------|
| `team-orchestrator.ts` | Lifecycle state machine (`plan -> exec -> verify -> fix/completed/failed`). |
| `monitor.ts` | Dead/non-reporting/watchdog health evaluation of team snapshots. |
| `types.ts` | Team/runtime/subagent type contracts, including `TaskClaimEntry` for per-worker pre-claimed assignments. |
| `subagents-blueprint.ts` | Built-in default subagent role blueprint definitions. |
| `subagents-catalog.ts` | Catalog loading/validation and requested role selection logic. |
| `role-output-contract.ts` | Contracts for role-specific output parsing. |
| `role-skill-mapping.ts` | Maps roles to skill sets. |
| `constants.ts` | Team-level constants. |
| `index.ts` | Public team-module exports. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `control-plane/` | Task lifecycle, mailbox lifecycle, failure taxonomy, and worker identity management. See `control-plane/AGENTS.md`. |
| `runtime/` | Backend implementations and registry (`tmux`, `subagents`). See `runtime/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Keep failure modes deterministic and actionable in returned errors/summaries.
- Maintain phase transition coherence and persistence side-effects.
- Treat subagents backend as experimental opt-in unless product direction changes.

### Testing Requirements
- Required after orchestrator/monitor/backend-contract changes:
  - `npm run test:reliability`
  - `npm run test:integration`

### Common Patterns
- Backend contract abstraction with pluggable registry.
- Monitor snapshots enriched with persisted worker signals before health evaluation.
- Orchestrator pre-assignment pattern: `TeamOrchestrator.preClaimTasksForWorkers()` claims tasks once in the control plane and passes `{ taskId, claimToken }` to workers, so workers should call `transitionTaskStatus` (not `claimTask`) for that claimed task.
- Runtime env propagation for pre-claimed work uses `OMG_WORKER_TASK_ID` and `OMG_WORKER_CLAIM_TOKEN` (injected by `runtime/tmux-backend.ts` and consumed by `cli/commands/worker-run.ts`).

## Dependencies

### Internal
- Depends on `src/state` for persistence and `src/team/runtime` for backend runtime operations.

### External
- Node crypto for run IDs and filesystem/path utilities in catalog loading.

<!-- MANUAL: -->
