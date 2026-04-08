# Durable Team State Schema (`.omp/state/team/<team>/`)

This contract defines persisted artifacts for team runtime observability and orchestration durability.

## Directory scaffold (deterministic)

- `events/`
- `workers/`
- `tasks/`
- `mailbox/`
- `phase.json`
- `monitor-snapshot.json`
- `run-request.json` (team run input persistence for resume)
- `resume-input.json` (compatibility resume input snapshot)

## Canonical files and ownership

### 1) Phase + lifecycle events

- `phase.json` (JSON, full replace)
  - writer: orchestrator only
  - canonical success terminal phase: `completed`
  - operational/manual shutdown before completion transitions phase to `failed`
    (so stop is distinct from success completion)
  - compatibility: legacy `complete` is read and normalized to `completed`
- `events/phase-transitions.ndjson` (append-only)
  - writer: orchestrator only
- `events/task-lifecycle.ndjson` (append-only)
  - writer: control-plane task lifecycle APIs only (`claim/transition/release`)
  - each entry includes deterministic `reasonCode`/`reason_code` context and hashed claim token digest metadata

### 2) Worker runtime signals

- `workers/worker-<n>/identity.json`
- `workers/worker-<n>/heartbeat.json`
- `workers/worker-<n>/status.json`
- `workers/worker-<n>/done.json`
- `workers/worker-<n>/inbox.md`
  - writer: orchestrator/state store path (or sanctioned telemetry bridge)
  - read by monitor/health checks for dead/non-reporting detection

Canonical worker identity / done metadata may also carry runtime-specific process
and evidence fields when required by a backend contract. For `gemini-spawn`, this
includes:

- `metadata.subagentId`
- `metadata.skills`
- `metadata.primarySkill`
- `metadata.roleArtifactBase`
- `metadata.roleArtifactRoot`
- `metadata.wrapperPid`
- `metadata.childPid`
- `metadata.signalForwardingMode`

These fields are backend metadata, but when they are persisted they must remain
stable enough for shutdown reconstruction and role-evidence loading.

### 3) Task objects

- `tasks/task-<id>.json` (canonical, full-object replace with monotonic `version`)
- `tasks/<id>.json` (legacy read-only compatibility)
  - writer: state store task API only
  - semantics: CAS-style updates via `expectedVersion`
  - API id contract: state APIs use normalized numeric task ids (example: `"1"`), while file name stays `task-1.json`

### 4) Mailbox logs

- `mailbox/worker-<n>.ndjson`
  - writer: state store mailbox append API only
  - semantics: append-only with stable `message_id`
  - compatibility: legacy `mailbox/<worker>.json` payloads are read-compatible

> Note: an earlier draft of this schema referenced a `mailbox/leader-fixed.ndjson` artifact. The current state store does not implement it; only per-worker mailboxes exist. Treat any residual references as planned and not yet persisted.

### 5) Team lifecycle input snapshots

- `run-request.json`
  - writer: `omp team run` command path
  - reader: `omp team resume`
  - purpose: durable replay of `task/backend/workers/subagents/maxFixLoop/watchdog/nonReporting`
- `resume-input.json` (compatibility bridge)
  - writer: `omp team run` command path
  - reader: `omp team resume` compatibility flows

## Write semantics

- JSON writes: atomic temp-file + rename.
- Task + mailbox writes: serialized through per-file single-writer queues in `TeamStateStore`.
- NDJSON logs: append-only records, never in-place rewrite.

## Control-plane mutation semantics (OmX/OmC parity layer)

Lifecycle mutations should go through `src/team/control-plane/` APIs instead of
direct raw state writes:

- Guardrail: `TeamStateStore.writeTask(...)` rejects lifecycle mutations
  (`in_progress|blocked|completed|failed|cancelled|canceled|unknown`, claim,
  result/error payloads) unless the write is explicitly marked as
  control-plane scoped.

- `claimTask(teamName, taskId, worker, leaseMs?)`
  - enforces unresolved-dependency rejection
  - writes `status=in_progress` + claim token + lease timestamp
- `transitionTaskStatus(teamName, taskId, worker, claimToken, from, to, ...)`
  - rejects mismatched claim tokens and expired leases
  - enforces current-status match (`from`) to prevent silent transitions
  - clears claim automatically on terminal task statuses
- `releaseTaskClaim(teamName, taskId, worker, claimToken, toStatus?)`
  - clears claim and returns task to a non-terminal queued status (`pending` by default)
- task lifecycle audit trail:
  - `appendTaskAuditEvent(...)` persists append-only claim/transition/release records to `events/task-lifecycle.ndjson`
  - includes deterministic action reason codes (`OMP_CP_TASK_*`) for adversarial verification and postmortem evidence
- Mailbox lifecycle helpers:
  - `markMailboxMessageNotified(...)`
  - `markMailboxMessageDelivered(...)`
  - use append-only lifecycle records with message-id collapse for idempotent reads

## Success-coupled snapshot fields

`monitor-snapshot.json` runtime metadata must preserve success-gate evidence:

- `runtime.verifyBaselinePassed` (boolean signal consumed by orchestrator checklist)
- `runtime.verifyBaselineSource` (backend/source traceability)
- `runtime.roleOutputs` (role assignment outputs with artifact references)
- `runtime.roleContract` (assignment/output counts + role-contract summary metadata)
- `runtime.successChecklist` (runtime status, task counts, health breakdown)
- `runtime.roleArtifactRoot` (deterministic artifact root for role evidence):
  - `.omp/state/team/<team>/artifacts/roles/`
- `runtime.workerProcesses` (worker -> persisted process metadata used for shutdown reconstruction):
  - `wrapperPid`
  - `childPid` (when known)
  - `signalForwardingMode` or equivalent lifecycle strategy metadata
- Referenced role artifacts must exist as non-empty files inside that root.

## Worker identity rule

Persisted runtime snapshots and worker signal directories must use canonical `worker-1..worker-N` identities.
Runtime-specific ids (tmux pane ids, subagent ids) are metadata only.
