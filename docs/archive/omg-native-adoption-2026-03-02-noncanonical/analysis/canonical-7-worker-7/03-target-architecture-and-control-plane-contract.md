# C3 — Target Architecture + Control-Plane Contract

## 1) Layered architecture (canonical)

1. **Operator surface layer**: CLI + extension commands
2. **Team control-plane layer (new/explicit)**: lifecycle orchestration APIs and invariants
3. **Runtime backend layer**: tmux (default), subagents (opt-in)
4. **State persistence layer**: deterministic file-backed state store
5. **Observability layer**: status/monitor/evidence summaries

## 2) Canonical control-plane API surface

```ts
claimTask(taskId: string, worker: string, opts?: { leaseMs?: number; expectedVersion?: number })
  -> { task, claimToken }

transitionTaskStatus(taskId: string, from: TaskStatus, to: TaskStatus, claimToken: string)
  -> { task }

releaseTaskClaim(taskId: string, claimToken: string)
  -> { task }
```

Required error taxonomy (deterministic):
- `task_not_found`
- `task_claim_conflict`
- `task_claim_blocked_dependency`
- `task_claim_lease_expired`
- `task_transition_invalid`
- `task_claim_owner_mismatch`
- `task_version_conflict`

## 3) Canonical task FSM

Allowed primary transitions:
- `pending -> in_progress`
- `in_progress -> completed`
- `in_progress -> failed`
- `in_progress -> pending` (only via validated release/retry path)

Guardrails:
- no terminal -> non-terminal transitions without explicit retry policy,
- no transition without valid claim token when task is claimed,
- dependency-blocked tasks cannot be claimed.

## 4) Runtime/backend parity contract

### tmux backend (default)
- MUST enforce worker protocol (ACK first, claim before execution)
- MUST propagate worker status updates to control-plane state
- MUST not mark orchestration success when protocol or task integrity fails

### subagents backend (opt-in)
- MUST produce equivalent lifecycle evidence and status semantics
- MAY remain staged/feature-flagged until deterministic parity proven

## 5) Namespace migration contract

- M1: runtime reads both `OMX_*` and `OMG_*` during migration window.
- M2: writes and docs prefer `OMG_*` immediately.
- M3: release gates fail when new behavior depends only on legacy-only env paths.
- M4: migration completion removes legacy-default assumptions.

## 6) File-level implementation parity map

| Requirement | Target files/modules |
|---|---|
| Control-plane module introduction | `src/team/control-plane/*` (new) |
| Shared lifecycle contracts | `src/team/contracts.ts` (new) + `src/team/types.ts` |
| CLI lifecycle commands | `src/cli/commands/team-status.ts` (new), `team-resume.ts` (new), `team-shutdown.ts` (new), `src/cli/index.ts` |
| Runtime enforcement hooks | `src/team/team-orchestrator.ts`, `src/team/runtime/tmux-backend.ts`, `src/team/runtime/subagents-backend.ts` |
| State mutation guards | `src/state/team-state-store.ts` |
| Status/monitor parity | `src/team/monitor.ts` |

## 7) Prohibited anti-patterns

1. Direct lifecycle field mutation from runtime path bypassing control-plane guards
2. Silent fallback to legacy success criteria in release paths
3. Divergent status models between CLI output and stored state
4. Protocol-enforcement logic duplicated inconsistently across backends

