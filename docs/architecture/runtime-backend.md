# Runtime Backend Contract

`oh-my-gemini` orchestration is runtime-backend driven.

## Interface

```ts
interface RuntimeBackend {
  name: "tmux" | "subagents";
  probePrerequisites(cwd: string): Promise<{ ok: boolean; issues: string[] }>;
  startTeam(input: TeamStartInput): Promise<TeamHandle>;
  monitorTeam(handle: TeamHandle): Promise<TeamSnapshot>;
  shutdownTeam(handle: TeamHandle, opts?: { force?: boolean }): Promise<void>;
}
```

## Backend policy

- **Default backend:** `tmux`
- **Alternative backend:** `subagents`
- **Worker-count contract:** `--workers` defaults to `3`, valid range is `1..8`, invalid values fail fast with exit code `2`.
- **Subagent assignment contract:** when explicit subagents are provided, assignment count must equal resolved worker count (mismatch fails fast with exit code `2`).
- **Fix-loop contract:** `--max-fix-loop` defaults to `3` and caps verify→fix retry attempts before terminal failure.
- Backend selection must be explicit in CLI output/state metadata.
- Worker identities persisted in runtime/state must use canonical `worker-<n>` ids.
- Backend prerequisite failures must be actionable and deterministic.
- Runtime code must not silently swap backends unless explicit fallback is configured by the caller.
- tmux worker bootstrap should export canonical `OMG_TEAM_*` env names and keep `OMX_TEAM_*` aliases for compatibility during migration.
- tmux worker bootstrap may also select worker execution mode per worker via `OMG_TEAM_WORKER_CLI` / `OMG_TEAM_WORKER_CLI_MAP` (`omg` or `gemini`).
- `OMG_TEAM_WORKER_CLI_MAP` accepts either one value for all workers or one comma-separated value per worker index.
- Gemini worker mode is implemented as prompt-mode execution inside `omg worker run`, preserving OMG state/done-signal contracts while delegating the task body to Gemini CLI.

## Durable state ownership contract

Team runtime state is persisted under `.omg/state/team/<team>/` and must be
mutated through state-store APIs (serialized single-writer path) rather than
ad-hoc direct file writes.

Task and mailbox lifecycle mutations should be mediated by the team control
plane (`src/team/control-plane/`) so claim-token guards, lease checks, and
notified/delivered mailbox semantics stay deterministic across runtime backends.

Canonical artifacts:

- `phase.json` + `events/phase-transitions.ndjson`
- `events/task-lifecycle.ndjson` (append-only claim/transition/release audit trail with reason codes)
- `monitor-snapshot.json`
- `run-request.json` (+ compatibility `resume-input.json`)
- `tasks/task-<id>.json` (legacy `<id>.json` remains read-compatible)
- `mailbox/<worker>.ndjson` (append-only; legacy `.json` remains read-compatible)
- `workers/<worker>/{identity,status,heartbeat,done}.json` and `workers/<worker>/inbox.md`

For detailed field-level schema and compatibility notes, see
[`state-schema.md`](./state-schema.md).

## Team-coordinated subagent model

Subagents are designed to mirror team-coordinated multi-agent execution semantics
(similar in spirit to `oh-my-claudecode Team`) while preserving deterministic
state transitions and observability.

### Catalog expectations

- Subagent definitions should be discovered from a project-level catalog
  (for example under `.gemini/agents/`).
- Catalog entries should provide stable role identity (`planner`, `executor`,
  `reviewer`, etc.) and execution metadata required by runtime startup.
- Catalog entries may provide optional `skills` and `aliases` arrays for
  deterministic token routing (for example `review` -> `code-reviewer`).
- Unknown requested subagents should fail fast with actionable diagnostics.

### Unified model principle

- All subagents in a run share one unified model configuration.
- Per-subagent model divergence is out of scope for this phase.
- Selected model/config must be visible in runtime metadata and/or monitor state
  for traceability.

### Explicit assignment/invocation

- Team run input can explicitly select subagents (for example
  `--subagents planner,executor`).
- Team run may also parse leading keyword tags in task text
  (for example `$planner /executor ...`) to auto-assign subagents.
- Canonical skill tags are also supported and resolve to primary role ids:
  - `plan` -> `planner`
  - `team` -> `executor`
  - `review` -> `code-reviewer`
  - `verify` -> `verifier`
  - `handoff` -> `writer`
- Team run also supports explicit backend tags at task prefix:
  - `/subagents` or `/agents` (same with `$` prefix) => request `subagents` backend,
  - `/tmux` (same with `$` prefix) => request `tmux` backend.
- Catalog entries may include `aliases` to map common skill-like tags to
  canonical role ids (for example `plan -> planner`, `review -> code-reviewer`,
  `verify -> verifier`, `handoff -> writer`).
- Alias selection resolves to canonical role ids and deduplicates canonical
  assignments (for example `review,code-reviewer` results in one role).
- Alias/ID collisions in catalog parsing fail fast with actionable diagnostics.
- Requested subagent list should be persisted into runtime metadata.
- Invocation behavior must remain deterministic for repeated runs with the same
  input and environment.
- For the normative role/skill registry and alias-fallback order, see
  [`role-skill-contract.md`](./role-skill-contract.md).

### Role output contract (subagents backend)

- When `runtime.selectedSubagents` is present, runtime metadata must include
  `runtime.roleOutputs` entries mapped to those assignments.
- Each role output must include:
  - `status` (`completed` is required for success; `failed|blocked` fail the contract)
  - `summary`
  - at least one artifact reference (`artifacts.*`)
- First-wave role requirements:
  - planner: `plan.steps[]`
  - executor: `implementation.changeSummary` + `implementation.commands[]`
  - verifier/qa/test: `verification[]` entries with `name`, `result`, `command` (`result=PASS` required for success)
  - reviewer/critic: `review.findings[]`
  - writer/documentation handoff: `handoff.notes`
- Artifact evidence must resolve to real files under deterministic role-artifact
  root paths:
  - `.omg/state/team/<team>/artifacts/roles/worker-<n>/<role>.json`
  - `.omg/state/team/<team>/artifacts/roles/worker-<n>/<role>.md`
- Missing/empty/out-of-root artifact files fail the role contract.
- Role-contract validation failures must fail the orchestrator success checklist deterministically.
- Subagents runtime monitor must set `status=failed` and
  `runtime.verifyBaselinePassed=false` when the role contract fails.

### Backend/role keyword precedence contract

When parsing leading task-prefix tags:

1. `--backend` (if provided) is authoritative.
2. If no `--backend` was passed, backend keyword tags choose the backend.
3. If no backend keywords are present, role tags or `--subagents` imply
   `subagents`; otherwise default is `tmux`.

Failure rules (fail fast, usage exit code `2`):

- conflicting backend keywords in the same prefix (for example `/tmux /subagents ...`),
- explicit `--backend` conflicts with backend keyword tags,
- role assignments are present while resolved backend is `tmux`.

## Error handling requirements

When backend execution cannot proceed:

1. fail fast with actionable diagnostics,
2. write failure reason to persisted state,
3. keep lifecycle phase transitions coherent (`plan -> exec -> verify -> fix -> completed|failed`).

## Verification expectations

- backend prerequisites validated before launch,
- lifecycle state emitted for `plan -> exec -> verify -> fix -> completed|failed`,
- clean shutdown path available for success and failure cases (manual shutdown
  of an in-flight run is treated as operational stop, not success completion),
- subagent selection and backend identity observable in run metadata,
- deterministic failure paths covered by reliability tests.

### Success checklist contract

Run success is allowed only when all checklist conditions pass:

- health monitor reports healthy (no dead/non-reporting/watchdog failures),
- runtime status is terminal `completed` (or legacy compatibility is explicitly enabled),
- runtime verify gate is explicit (`runtime.verifyBaselinePassed === true`, unless legacy compatibility is intentionally enabled),
- required persisted tasks are all `completed` and no persisted task is `failed`.
- selected subagent role outputs satisfy the role output contract.

## Reliability semantics

Health evaluation is applied on every `monitorTeam` snapshot:

- worker status `failed` => dead worker signal,
- worker status `running|blocked|unknown` requires a heartbeat (`lastHeartbeatAt`),
- stale heartbeat (older than non-reporting threshold) => non-reporting signal,
- invalid or stale snapshot timestamp (`updatedAt`) => watchdog signal.
- runtime snapshots must provide `runtime.verifyBaselinePassed` as an explicit
  boolean gate signal; missing/false values fail the success checklist unless
  legacy compatibility mode is intentionally enabled.

The orchestrator merges runtime snapshots with persisted worker telemetry from:

- `.omg/state/team/<team>/workers/<worker>/heartbeat.json`
- `.omg/state/team/<team>/workers/<worker>/status.json`

This allows reliability checks to catch failures even when runtime backends
provide minimal worker metadata.

### Legacy compatibility toggles (temporary)

- `OMG_LEGACY_RUNNING_SUCCESS=1`: treat runtime `running` status as passable.
- `OMG_LEGACY_VERIFY_GATE_PASS=1`: treat missing verify baseline signal as passable.

### Threshold controls

- CLI:
  - `omg team run --watchdog-ms <n>`
  - `omg team run --non-reporting-ms <n>`
- Environment defaults:
  - `OMG_TEAM_WATCHDOG_MS`
  - `OMG_TEAM_NON_REPORTING_MS`
