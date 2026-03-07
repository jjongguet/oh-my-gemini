# `omg` Command Quick Reference

> `oh-my-gemini` and `omg` are equivalent CLI entry points.
> Post-global-install contract: after `npm install -g oh-my-gemini-sisyphus`, run setup with
> `omg setup --scope project` (equivalent: `oh-my-gemini setup --scope project`).

## `omg setup`

```bash
omg setup [--scope <project|user>] [--dry-run] [--json]
```

- Persists setup scope precedence:
  `--scope` > `.omg/setup-scope.json` > default `project`
- Provisions managed setup artifacts (including `.gemini/agents/catalog.json`)
- Primary post-install command after global npm installation

## `omg doctor`

```bash
omg doctor [--json] [--strict|--no-strict] [--fix] [--extension-path <path>]
```

- Checks node/npm/gemini/tmux/container runtime + extension integrity + `.omg/state` writeability
- `--fix` applies safe remediations and reruns diagnostics

## `omg extension path`

```bash
omg extension path [--json] [--extension-path <path>]
```

- Resolves extension root precedence:
  `--extension-path` / `OMG_EXTENSION_PATH` > `./extensions/oh-my-gemini` > installed package assets
- Useful for user install flow:

```bash
EXT_PATH="$(oh-my-gemini extension path)"
gemini extensions link "$EXT_PATH"
```

## `omg hud`

```bash
omg hud [--team <name>] [--preset minimal|focused|full] [--json]
omg hud --watch [--interval-ms 1000]
```

- Renders an OMG HUD status overlay from persisted team state under `.omg/state/team/<team>/`
- Includes task/worker progress indicators (`[#---]` bars + percentages) with Gemini API/model metadata
- Reads default preset from `.gemini/hud-config.json` (falls back to `focused`)
- `--json` returns raw HUD context for scripting/integration
- `--watch` enables real-time overlay refresh (TTY mode, default interval: 1s)

## `omg mcp serve`

```bash
omg mcp serve [--dry-run] [--json]
```

- Starts an MCP stdio server exposing oh-my-gemini tools/resources/prompts.
- Built-in tools include file tools (`file_list`, `file_read`, `file_write`, `file_stat`),
  `exec_run`, and team status/task lifecycle/mailbox helpers.
- Built-in resources include team status snapshot + skill catalog + `GEMINI.md` context.
- Built-in prompts include `team_plan`, `team_status_summary`, and `skill_execution` templates.
- `--dry-run` resolves and prints the MCP surface without opening stdio transport.

## `omg tools`

```bash
omg tools list [--json] [--categories <file,git,http,process>]
omg tools serve [--categories <file,git,http,process>]
omg tools manifest [--json] [--categories <file,git,http,process>] [--bin <command>] [--server-name <name>]
```

- Built-in MCP tools are grouped by category: `file`, `git`, `http`, `process`
- `tools serve` runs an MCP stdio server exposing selected categories
- `tools manifest` prints a Gemini-compatible `mcpServers` snippet for extension/settings registration

## `omg team run`

```bash
omg team run --task "<description>" \
  [--backend tmux|subagents] \
  [--workers <1..8>] \
  [--subagents <ids>] \
  [--max-fix-loop <0..3>] \
  [--watchdog-ms <n>] \
  [--non-reporting-ms <n>] \
  [--dry-run] [--json]
```

- Default backend: `tmux`
- Auto-selects backend from leading backend tags (`/tmux`, `/subagents`, `/agents`) when `--backend` is omitted
- Auto-switches to `subagents` when role tags/`--subagents` are used
- Worker range contract: `1..8`
- Catalog aliases can be used in tags/`--subagents` (for example `plan`, `execute`, `review`, `verify`, `handoff`)
- Persists run-request metadata to `.omg/state/team/<team>/run-request.json` for `team resume`
- `--watchdog-ms` configures worker heartbeat liveness timeout
- `--non-reporting-ms` configures non-reporting timeout for worker health/degradation handling

## `omg team status`

```bash
omg team status [--team <name>] [--json]
```

- Reads persisted lifecycle data from `.omg/state/team/<team>/`
- Summarizes phase/runtime/task/worker health
- Includes worker heartbeat/non-reporting evidence in health evaluation
- Returns non-zero when state is missing or degraded (`failed` phase/runtime,
  `stopped` runtime without `completed` phase, unhealthy workers, or failed tasks)

## `omg team resume`

```bash
omg team resume [--team <name>] \
  [--task "<description>"] \
  [--backend tmux|subagents] \
  [--workers <1..8>] \
  [--subagents <ids>] \
  [--max-fix-loop <0..3>] \
  [--watchdog-ms <n>] \
  [--non-reporting-ms <n>] \
  [--dry-run] [--json]
```

- Reloads persisted run-request metadata from `.omg/state/team/<team>/run-request.json`
- Supports overrides (`--task`, `--backend`, `--workers`, `--subagents`) when persisted metadata is incomplete
- Supports override of fix-loop and health thresholds
- `--watchdog-ms` and `--non-reporting-ms` retune heartbeat/non-reporting thresholds on resume
- `--dry-run` validates resolved resume input without executing runtime
- Fails with actionable guidance if no prior run request exists

## `omg team shutdown`

```bash
omg team shutdown [--team <name>] [--force] [--json]
```

- Attempts runtime shutdown using persisted monitor snapshot metadata
- Updates monitor snapshot status to `stopped`
- If the run was still in-flight, persists phase as `failed` (operational stop),
  keeping manual shutdown distinct from success completion
- `--force` turns missing-runtime situations into safe no-op cleanup

## `omg verify`

```bash
omg verify [--suite typecheck,smoke,integration,reliability] [--tier light|standard|thorough] [--dry-run] [--json]
```

Default suites:

- `typecheck`
- `smoke`
- `integration`
- `reliability`

Tier bundles:

- `light` => `typecheck,smoke`
- `standard` => `typecheck,smoke,integration`
- `thorough` => `typecheck,smoke,integration,reliability`
