# OmG-native Canonical 03 — Target Architecture and Control-Plane Contract (Worker 4)

Date: 2026-03-02  
Status: **Canonical**  
Depends on: C1, C2

## 1) Target architecture (authoritative)

```text
CLI
 ├─ team run/status/resume/shutdown
 └─ verify/setup/doctor/extension
      │
      ▼
Team Control Plane (single mutation authority)
 ├─ task lifecycle (claim/transition/release)
 ├─ mailbox (send/list/deliver)
 ├─ worker protocol validator
 └─ team status/resume/shutdown orchestration helpers
      │
      ├─ Team Orchestrator (phase loop: plan→exec→verify→fix→completed|failed)
      └─ Runtime Backend adapters (tmux default, subagents opt-in)
             │
             ▼
Durable State Store (.omg/state/team/<team>/...)
```

## 2) Architecture contract decisions

1. **Single mutation authority**: lifecycle state writes must pass through control-plane/state APIs.
2. **Backend-neutral policy**: control-plane semantics are shared across tmux and subagents.
3. **Operator lifecycle support**: status/resume/shutdown read and mutate state using the same contract as run.
4. **Role contract integration**: role execution outputs are first-class evidence in completion decisions.

## 3) Control-plane interface requirements (normative)

## 3.1 Task lifecycle contract

- `claimTask(taskId, worker, expectedVersion?) -> { claimToken, leasedUntil }`
- `transitionTaskStatus(taskId, from, to, claimToken)`
- `releaseTaskClaim(taskId, claimToken, worker)`

Required behavior:

- stale or mismatched claim tokens fail deterministically,
- illegal `from -> to` transitions fail deterministically,
- version progression is monotonic,
- mutation events are auditable.

## 3.2 Mailbox contract

- append-only message writes,
- stable message IDs,
- explicit delivered/notified markers,
- consistent worker naming (`worker-<n>`, `leader-fixed`).

## 3.3 Worker protocol validator

Required ordered sequence per worker task path:

1. worker identity resolved,
2. ACK to lead,
3. task claimed,
4. work result recorded (`completed` or `failed` + structured payload),
5. worker status set to terminal/idle.

Protocol violations must surface as monitor-visible failure reasons.

## 4) Role/skill contract v1 requirements

Minimum blocking role set:

- `planner`
- `executor`
- `verifier`

Each required role MUST define:

- input contract (task context + constraints),
- expected artifact schema (structured output),
- verification command responsibilities,
- failure escalation behavior.

Role artifact generation must be deterministic and linked from team state/evidence bundle.

## 5) File-level implementation parity map

| Domain | Required target files/modules |
|---|---|
| CLI lifecycle expansion | `src/cli/index.ts`, new `src/cli/commands/team-status.ts`, `team-resume.ts`, `team-shutdown.ts` |
| Control-plane layer | new `src/team/control-plane/index.ts`, `task-lifecycle.ts`, `mailbox.ts`, `worker-protocol.ts` |
| Orchestrator integration | `src/team/team-orchestrator.ts` |
| Runtime enforcement | `src/team/runtime/tmux-backend.ts`, `src/team/runtime/subagents-backend.ts`, `src/team/runtime/runtime-backend.ts` |
| State schema/semantics | `src/state/team-state-store.ts`, `src/state/types.ts`, `docs/architecture/state-schema.md` |
| Role/skill contracts | new `src/team/contracts.ts`, `extensions/oh-my-gemini/skills/*`, `.gemini/agents/catalog.json` |
| Operator docs | `docs/omg/commands.md`, `docs/testing/live-team-e2e.md`, `docs/testing/gates.md` |

## 6) Architecture anti-patterns (explicitly forbidden)

1. Runtime codepaths directly editing `tasks/task-<id>.json` lifecycle fields.
2. Backend-specific ad-hoc transition logic that bypasses shared validation.
3. “Completed” status emission without verify baseline + role evidence checks.
4. Hidden compatibility toggles that are required for release gates to pass.

## 7) Architecture exit criteria

C3 architecture parity is complete when:

- control-plane layer is the only mutation path in production code,
- operator lifecycle commands are implemented against that layer,
- role contract evidence is consumed by completion checks,
- integration + reliability suites cover happy and failure paths.
