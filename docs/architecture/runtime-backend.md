# Runtime Backend Contract

`oh-my-gemini` orchestration is runtime-backend driven.

## Interface

```ts
interface RuntimeBackend {
  name: 'tmux' | 'subagents';
  probePrerequisites(cwd: string): Promise<{ ok: boolean; issues: string[] }>;
  startTeam(input: TeamStartInput): Promise<TeamHandle>;
  monitorTeam(handle: TeamHandle): Promise<TeamSnapshot>;
  shutdownTeam(handle: TeamHandle, opts?: { force?: boolean }): Promise<void>;
}
```

## Backend policy

- **Default backend:** `tmux`
- **Alternative backend:** `subagents`
- Backend selection must be explicit in CLI output/state metadata.
- Backend prerequisite failures must be actionable and deterministic.
- Runtime code must not silently swap backends unless explicit fallback is configured by the caller.

## Team-coordinated subagent model

Subagents are designed to mirror team-coordinated multi-agent execution semantics
(similar in spirit to `oh-my-claudecode Team`) while preserving deterministic
state transitions and observability.

### Catalog expectations

- Subagent definitions should be discovered from a project-level catalog
  (for example under `.gemini/agents/`).
- Catalog entries should provide stable role identity (`planner`, `executor`,
  `reviewer`, etc.) and execution metadata required by runtime startup.
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
- Requested subagent list should be persisted into runtime metadata.
- Invocation behavior must remain deterministic for repeated runs with the same
  input and environment.

## Error handling requirements

When backend execution cannot proceed:

1. fail fast with actionable diagnostics,
2. write failure reason to persisted state,
3. keep lifecycle phase transitions coherent (`plan -> exec -> verify -> fix/failed`).

## Verification expectations

- backend prerequisites validated before launch,
- lifecycle state emitted for `plan -> exec -> verify`,
- clean shutdown path available for success and failure cases,
- subagent selection and backend identity observable in run metadata,
- deterministic failure paths covered by reliability tests.

## Reliability semantics

Health evaluation is applied on every `monitorTeam` snapshot:

- worker status `failed` => dead worker signal,
- worker status `running|blocked|unknown` requires a heartbeat (`lastHeartbeatAt`),
- stale heartbeat (older than non-reporting threshold) => non-reporting signal,
- invalid or stale snapshot timestamp (`updatedAt`) => watchdog signal.

The orchestrator merges runtime snapshots with persisted worker telemetry from:

- `.omg/state/team/<team>/workers/<worker>/heartbeat.json`
- `.omg/state/team/<team>/workers/<worker>/status.json`

This allows reliability checks to catch failures even when runtime backends
provide minimal worker metadata.

### Threshold controls

- CLI:
  - `omg team run --watchdog-ms <n>`
  - `omg team run --non-reporting-ms <n>`
- Environment defaults:
  - `OMG_TEAM_WATCHDOG_MS`
  - `OMG_TEAM_NON_REPORTING_MS`
