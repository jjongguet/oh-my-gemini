# Runtime Backend Contract

`oh-my-gemini` orchestration is runtime-backend driven.

## Interface (target)

```ts
interface RuntimeBackend {
  name: 'tmux' | 'subagents';
  probePrerequisites(cwd: string): Promise<{ ok: boolean; issues: string[] }>;
  startTeam(input: TeamStartInput): Promise<TeamHandle>;
  monitorTeam(handle: TeamHandle): Promise<TeamSnapshot>;
  shutdownTeam(handle: TeamHandle, opts?: { force?: boolean }): Promise<void>;
}
```

## Policy

- **Default backend:** `tmux`
- **Subagents backend:** experimental opt-in only
- Subagents opt-in can be enabled via:
  - `OMG_EXPERIMENTAL_ENABLE_AGENTS=true` (env), or
  - `.gemini/settings.json` with `"experimental": { "enableAgents": true }`
- Backend selection should be explicit and observable in logs/state

## Error handling requirements

When backend selection cannot proceed:

1. fail fast with actionable diagnostics,
2. write failure reason to state,
3. do not silently switch backends unless explicit fallback is configured.

## Verification expectations

- backend prerequisites validated before launch,
- lifecycle state emitted for `plan -> exec -> verify`,
- clean shutdown path available for success and failure cases.

## Reliability semantics (Gate 2)

Health evaluation is applied on every `monitorTeam` snapshot:

- worker status `failed` => dead worker signal,
- worker status `running|blocked|unknown` requires a heartbeat (`lastHeartbeatAt`),
- stale heartbeat (older than non-reporting threshold) => non-reporting signal,
- invalid or stale snapshot timestamp (`updatedAt`) => watchdog signal.

The orchestrator merges runtime snapshots with persisted worker telemetry from:

- `.omg/state/team/<team>/workers/<worker>/heartbeat.json`
- `.omg/state/team/<team>/workers/<worker>/status.json`

This allows reliability checks to catch failures even when runtime backends provide
minimal worker metadata.

### Threshold controls

- CLI:
  - `omg team run --watchdog-ms <n>`
  - `omg team run --non-reporting-ms <n>`
- Environment defaults:
  - `OMG_TEAM_WATCHDOG_MS`
  - `OMG_TEAM_NON_REPORTING_MS`
