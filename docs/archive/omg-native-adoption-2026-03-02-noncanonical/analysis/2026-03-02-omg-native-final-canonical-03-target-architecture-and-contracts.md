# OmG-native Final Canonical Set (03/07): Target Architecture and Normative Contracts

Date: 2026-03-02  
Status: **Normative architecture contract**

## 1) Target architecture (OmG-native, not clone)

## Layer A — CLI operator surface
- `omg team run|status|resume|shutdown`
- CLI is command/UX boundary only; lifecycle semantics are delegated to control-plane/runtime layers.

## Layer B — Team control-plane (new/expanded)
- Single mutation path for task lifecycle safety.
- Owns claim, transition, release, dependency readiness logic.

## Layer C — Runtime backends
- tmux default path (production intent)
- subagents opt-in path (controlled by parity gates)
- both consume the same control-plane contracts.

## Layer D — Worker protocol
- Required sequence: `ACK -> claim -> execute -> result -> idle`
- Runtime must reject non-compliant worker lifecycle behavior.

## Layer E — Role/skill/evidence contract
- Role selection must map to defined skill workflow + required evidence schema.
- Completion truth requires evidence integrity, not only terminal status strings.

## Layer F — Verification & release gates
- CI/release gates validate lifecycle correctness, runtime truthfulness, and docs contract parity.

---

## 2) Control-plane contract (required API shape)

The architecture requires a first-class control-plane contract equivalent to:

```ts
interface TeamControlPlane {
  claimTask(input: {
    teamName: string;
    taskId: string;
    worker: string;
    expectedVersion?: number;
    leaseMs?: number;
  }): Promise<{ task: PersistedTaskRecord; claimToken: string }>;

  transitionTaskStatus(input: {
    teamName: string;
    taskId: string;
    from: PersistedTaskStatus;
    to: PersistedTaskStatus;
    worker: string;
    claimToken: string;
  }): Promise<PersistedTaskRecord>;

  releaseTaskClaim(input: {
    teamName: string;
    taskId: string;
    worker: string;
    claimToken: string;
  }): Promise<PersistedTaskRecord>;
}
```

### Required semantics
- deterministic conflict errors
- token/owner validation
- lease expiry handling
- dependency-blocked claim rejection
- monotonic version/CAS safety

---

## 3) Canonical task transition rules

| From | Allowed to | Notes |
|---|---|---|
| `pending` | `in_progress`, `blocked`, `cancelled` | `in_progress` requires valid claim |
| `blocked` | `pending`, `in_progress`, `failed`, `cancelled` | `in_progress` requires dependencies satisfied + claim |
| `in_progress` | `completed`, `failed`, `blocked`, `cancelled` | terminal transitions require owner/token validation |
| `completed` | *(none)* | terminal |
| `failed` | `pending` (explicit retry path only) | retry must clear/reacquire claim |
| `cancelled`/`canceled` | *(none)* | terminal alias normalized in persistence |

Invalid transitions must fail with explicit reason codes.

---

## 4) Worker protocol contract (runtime-enforced)

## Required startup contract
1. Resolve identity (`teamName`, `workerName`) and canonical team state root.
2. Send lead ACK mailbox message.
3. Read inbox + assigned task.
4. Claim task before execution.

## Required completion contract
1. Write structured task result (`completed` or `failed` + summary/evidence).
2. Update worker status to `idle` with timestamp.
3. Publish completion/done signal (where supported by runtime flow).

## Failure contract
- missing ACK, missing claim, invalid transition, stale claim, or malformed evidence -> runtime marks non-compliant and fails verification path.

---

## 5) Role/skill/evidence v1 contract

## Required role set
- `planner`
- `executor`
- `verifier`

## Required skill set
- `plan`
- `execute`
- `review`
- `verify`
- `handoff`

## Minimum evidence schema (logical)

```json
{
  "role": "planner|executor|verifier",
  "skill": "plan|execute|review|verify|handoff",
  "summary": "string",
  "artifacts": [{ "path": "string", "kind": "plan|code|test|report|handoff" }],
  "verification": [
    { "name": "command", "status": "PASS|FAIL", "outputRef": "string" }
  ],
  "timestamp": "ISO-8601"
}
```

---

## 6) Concrete implementation parity targets

| Area | Required file targets |
|---|---|
| CLI lifecycle commands | `src/cli/index.ts`, `src/cli/commands/team-*.ts`, `docs/omg/commands.md`, `extensions/oh-my-gemini/commands/team/*.toml` |
| Control-plane lifecycle APIs | new `src/team/control-plane/*`, `src/team/*`, `src/state/team-state-store.ts`, `src/state/types.ts` |
| Worker protocol hardening | `src/team/runtime/tmux-backend.ts`, `src/team/team-orchestrator.ts`, worker prompt/template surfaces |
| Role/skill contracts | `src/team/subagents-catalog.ts`, `src/team/subagents-blueprint.ts`, `extensions/oh-my-gemini/skills/*` |
| Verification gates | `tests/integration/*`, `tests/reliability/*`, `docs/testing/gates.md`, `.github/workflows/*.yml` |

---

## 7) Migration constraints (must not break)

1. Preserve extension-first user entrypoints.
2. Preserve tmux as default backend.
3. Preserve `.omg/state/team/<team>/...` path contract.
4. Preserve existing `team run` contract and exit-code semantics.
5. Keep changes additive-first; normalize legacy fields, do not silently drop compatibility reads.

