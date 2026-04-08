# `omp` Command Quick Reference

> `oh-my-product` and `omp` are equivalent CLI entry points.
> Post-global-install contract: after `npm install -g oh-my-product`, run setup with
> `omp setup --scope project` (equivalent: `oh-my-product setup --scope project`).

> Internal compatibility note: user-facing command/docs surfaces use `omp`, while
> legacy hidden state paths, legacy environment variable names, and legacy
> internal interop identifiers remain intentionally unchanged in this pass.

## `omp setup`

```bash
omp setup [--scope <project|user>] [--dry-run] [--json]
```

- Persists setup scope precedence:
  `--scope` > `.omp/setup-scope.json` > default `project`
- Provisions managed setup artifacts (including `.gemini/agents/catalog.json`)
- Primary post-install command after global npm installation

## `omp doctor`

```bash
omp doctor [--json] [--strict|--no-strict] [--fix] [--extension-path <path>]
```

- Checks node/npm/gemini/tmux/container runtime + extension integrity + `.omp/state` writeability
- `--fix` applies safe remediations and reruns diagnostics

## `omp extension path`

```bash
omp extension path [--json] [--extension-path <path>]
```

- Resolves extension root precedence:
  `--extension-path` / `OMP_EXTENSION_PATH` > `.` > installed package assets
- Useful for user install flow:

```bash
EXT_PATH="$(oh-my-product extension path)"
gemini extensions install "$EXT_PATH"
```

## `omp hud`

```bash
omp hud [--team <name>] [--preset minimal|focused|full] [--json]
omp hud --watch [--interval-ms 1000]
```

- Renders an omp HUD status overlay from persisted team state under `.omp/state/team/<team>/`
- Includes task/worker progress indicators (`[#---]` bars + percentages) with Gemini API/model metadata
- Reads default preset from `.gemini/hud-config.json` (falls back to `focused`)
- `--json` returns raw HUD context for scripting/integration
- `--watch` enables real-time overlay refresh (TTY mode, default interval: 1s)

## `omp mcp serve`

```bash
omp mcp serve [--dry-run] [--json]
```

- Starts an MCP stdio server exposing oh-my-product tools/resources/prompts.
- Built-in tools include file tools (`file_list`, `file_read`, `file_write`, `file_stat`),
  `exec_run`, and team status/task lifecycle/mailbox helpers.
- Built-in resources include team status snapshot + skill catalog + `GEMINI.md` context.
- Built-in prompts include `team_plan`, `team_status_summary`, and `skill_execution` templates.
- `--dry-run` resolves and prints the MCP surface without opening stdio transport.

## `omp tools`

```bash
omp tools list [--json] [--categories <file,git,http,process>]
omp tools serve [--categories <file,git,http,process>]
omp tools manifest [--json] [--categories <file,git,http,process>] [--bin <command>] [--server-name <name>]
```

- Built-in MCP tools are grouped by category: `file`, `git`, `http`, `process`
- `tools serve` runs an MCP stdio server exposing selected categories
- `tools manifest` prints a Gemini-compatible `mcpServers` snippet for extension/settings registration

## `omp team run`

```bash
omp team run --task "<description>" \
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
- Persists run-request metadata to `.omp/state/team/<team>/run-request.json` for `team resume`
- `--watchdog-ms` configures worker heartbeat liveness timeout
- `--non-reporting-ms` configures non-reporting timeout for worker health/degradation handling

## `omp team status`

```bash
omp team status [--team <name>] [--json]
```

- Reads persisted lifecycle data from `.omp/state/team/<team>/`
- Summarizes phase/runtime/task/worker health
- Includes worker heartbeat/non-reporting evidence in health evaluation
- Returns non-zero when state is missing or degraded (`failed` phase/runtime,
  `stopped` runtime without `completed` phase, unhealthy workers, or failed tasks)

## `omp team resume`

```bash
omp team resume [--team <name>] \
  [--task "<description>"] \
  [--backend tmux|subagents] \
  [--workers <1..8>] \
  [--subagents <ids>] \
  [--max-fix-loop <0..3>] \
  [--watchdog-ms <n>] \
  [--non-reporting-ms <n>] \
  [--dry-run] [--json]
```

- Reloads persisted run-request metadata from `.omp/state/team/<team>/run-request.json`
- Supports overrides (`--task`, `--backend`, `--workers`, `--subagents`) when persisted metadata is incomplete
- Supports override of fix-loop and health thresholds
- `--watchdog-ms` and `--non-reporting-ms` retune heartbeat/non-reporting thresholds on resume
- `--dry-run` validates resolved resume input without executing runtime
- Fails with actionable guidance if no prior run request exists

## `omp team shutdown`

```bash
omp team shutdown [--team <name>] [--force] [--json]
```

- Attempts runtime shutdown using persisted monitor snapshot metadata
- Updates monitor snapshot status to `stopped`
- If the run was still in-flight, persists phase as `failed` (operational stop),
  keeping manual shutdown distinct from success completion
- `--force` turns missing-runtime situations into safe no-op cleanup

## `omp verify`

```bash
omp verify [--suite typecheck,smoke,integration,reliability] [--tier light|standard|thorough] [--dry-run] [--json]
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
