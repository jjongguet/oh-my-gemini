# Durable Team State Schema (`.omg/state/team/<team>/`)

This contract defines persisted artifacts for team runtime observability and orchestration durability.

## Directory scaffold (deterministic)

- `events/`
- `workers/`
- `tasks/`
- `mailbox/`
- `phase.json`
- `monitor-snapshot.json`

## Canonical files and ownership

### 1) Phase + lifecycle events

- `phase.json` (JSON, full replace)
  - writer: orchestrator only
  - canonical terminal phase: `completed`
  - compatibility: legacy `complete` is read and normalized to `completed`
- `events/phase-transitions.ndjson` (append-only)
  - writer: orchestrator only

### 2) Worker runtime signals

- `workers/worker-<n>/identity.json`
- `workers/worker-<n>/heartbeat.json`
- `workers/worker-<n>/status.json`
- `workers/worker-<n>/done.json`
- `workers/worker-<n>/inbox.md`
  - writer: orchestrator/state store path (or sanctioned telemetry bridge)
  - read by monitor/health checks for dead/non-reporting detection

### 3) Task objects

- `tasks/task-<id>.json` (canonical, full-object replace with monotonic `version`)
- `tasks/<id>.json` (legacy read-only compatibility)
  - writer: state store task API only
  - semantics: CAS-style updates via `expectedVersion`
  - API id contract: state APIs use normalized numeric task ids (example: `"1"`), while file name stays `task-1.json`

### 4) Mailbox logs

- `mailbox/leader-fixed.ndjson`
- `mailbox/worker-<n>.ndjson`
  - writer: state store mailbox append API only
  - semantics: append-only with stable `message_id`
  - compatibility: legacy `mailbox/<worker>.json` payloads are read-compatible

## Write semantics

- JSON writes: atomic temp-file + rename.
- Task + mailbox writes: serialized through per-file single-writer queues in `TeamStateStore`.
- NDJSON logs: append-only records, never in-place rewrite.

## Success-coupled snapshot fields

`monitor-snapshot.json` runtime metadata must preserve success-gate evidence:

- `runtime.verifyBaselinePassed` (boolean signal consumed by orchestrator checklist)
- `runtime.verifyBaselineSource` (backend/source traceability)
- `runtime.successChecklist` (runtime status, task counts, health breakdown)

## Worker identity rule

Persisted runtime snapshots and worker signal directories must use canonical `worker-1..worker-N` identities.
Runtime-specific ids (tmux pane ids, subagent ids) are metadata only.
