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

## Additional CLI commands

The following commands are registered in the `omp` binary. Each entry lists the invocation and a short description; see `omp <cmd> --help` for the full flag set.

### `omp launch`

```bash
omp launch [--madmax] [...gemini passthrough flags]
```

- Default command when `omp` is invoked with no subcommand. Launches Gemini CLI with the oh-my-product extension loaded, inside a tmux session.
- Surface: dual (also `/omp:launch`).

### `omp update`

```bash
omp update
```

- Updates the globally installed `oh-my-product` package. Surface: ts-only.

### `omp uninstall`

```bash
omp uninstall
```

- Uninstalls the `oh-my-product` package and removes managed extension assets. Surface: ts-only.

### `omp version`

```bash
omp version [--json]
```

- Prints the CLI package version. Surface: ts-only.

### `omp ask`

```bash
omp ask "<prompt>" [--model <name>] [--json]
```

- One-shot question to Gemini via the configured model. Surface: dual (also `/omp:ask`).

### `omp cost`

```bash
omp cost [--since <iso>] [--json]
```

- Summarizes token and dollar cost from persisted session/token logs. Surface: dual.

### `omp sessions`

```bash
omp sessions [list|show <id>] [--json]
```

- Lists and inspects persisted session records. Surface: dual.

### `omp wait`

```bash
omp wait [--team <name>] [--timeout-ms <n>] [--json]
```

- Blocks until a team run reaches a terminal state. Surface: dual.

### `omp prd`

```bash
omp prd [subcommand] [...args]
```

- PRD workflow helpers (generation, locking, summary). Surface: ts-only.

### `omp skill`

```bash
omp skill list [--json]
omp skill <name> [args...]
```

- Lists packaged and repo-local skills, prints their `SKILL.md` content, and expands arguments into prompt text. Surface: ts-only.

### `omp explore`

```bash
omp explore "<query>" [--json]
```

- Fast read-only codebase exploration using the explore agent. Surface: ts-only.

### `omp reasoning`

```bash
omp reasoning [set <level>|show] [--json]
```

- Reads or writes reasoning effort configuration at `.omp/state/reasoning.json`. Surface: dual (also `/omp:reasoning`).

### `omp ralph`

```bash
omp ralph "<task>" [--max-iterations <n>] [--json]
```

- Launches the iterative ralph fix-loop mode. Surface: dual (also `/omp:ralph`).

### `omp autoresearch`

```bash
omp autoresearch "<topic>" [--json]
```

- Autonomous research flow that delegates to the document-specialist agent. Surface: ts-only.

### `omp hooks`

```bash
omp hooks [list|run <event>] [--json]
```

- Lists registered hooks and, for debugging, simulates hook pipeline execution. Surface: ts-only.

### `omp cleanup`

```bash
omp cleanup [--team <name>] [--dry-run] [--json]
```

- Cleans persisted team state under `.omp/state/team/<team>/`. Surface: ts-only.

### `omp design init|plan|validate|verify`

```bash
omp design init [--json]
omp design plan [--json]
omp design validate [--json]
omp design verify [--json]
```

- Design workflow subcommands that plug into the design-architect / design-validator / implementation-planner agents. Surface: dual (matching `/omp:design-init`, `/omp:design-plan`, `/omp:design-validate`, `/omp:design-verify` TOML commands).

### `omp team cancel`

```bash
omp team cancel [--team <name>] [--json]
```

- Cancels a running team without force-shutting-down the runtime. Surface: ts-only.

### `omp worker run`

```bash
omp worker run --team <name> --worker <id>
```

- Internal worker bootstrap entry point used by runtime backends. Not intended for direct operator use. Surface: ts-only.

## TOML-only slash commands

Many `/omp:*` slash commands are exposed only inside Gemini CLI and have no `omp <cmd>` counterpart. Examples include (non-exhaustive):

`/omp:autopilot`, `/omp:plan`, `/omp:execute`, `/omp:review`, `/omp:debug`, `/omp:status`, `/omp:cancel`, `/omp:handoff`, `/omp:help`, `/omp:learn`, `/omp:memory`, `/omp:mode`, `/omp:intent`, `/omp:approval`, `/omp:workspace`, `/omp:taskboard`, `/omp:checkpoint`, `/omp:consensus`, `/omp:optimize`, `/omp:rules`, `/omp:ultrawork`, `/omp:loop`, `/omp:stop`, `/omp:configure-notifications`, `/omp:deep-interview`, `/omp:hud-setup`, `/omp:team/assemble`, `/omp:team/plan`, `/omp:team/prd`, `/omp:team/exec`, `/omp:team/subagents`, `/omp:team/verify`, `/omp:team/live`, `/omp:design/brief`, `/omp:design/design-system`, `/omp:design/ux-review`, `/omp:project/phase-plan`.

See `commands/omp/*.toml` for the authoritative list.
