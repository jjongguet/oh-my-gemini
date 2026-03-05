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
omg verify [--suite typecheck,smoke,integration,reliability] [--dry-run] [--json]
```

Default suites:

- `typecheck`
- `smoke`
- `integration`
- `reliability`

## `omg prd`

```bash
omg prd <init|status|next|validate|complete|reopen> [options]
```

Ralph-style PRD workflow commands for acceptance-criteria driven execution:

- resolves PRD file path from `--file`, then `./prd.json`, then `./.omg/prd.json`
- validates PRD structure against the typed contract (`userStories`, `acceptanceCriteria`, `passes`)
- supports criterion-level completion gating (`complete` requires criteria evidence unless bypassed)

### `omg prd init`

```bash
omg prd init [--file <path>] [--task "<description>"] [--project <name>] [--branch <name>] [--description "<text>"] [--force] [--json]
```

- Initializes `prd.json` scaffold with one `US-001` story and default acceptance criteria
- Fails if file exists unless `--force` is set

### `omg prd status`

```bash
omg prd status [--file <path>] [--json]
```

- Reports PRD completion status (`total/completed/pending/nextStory`) and validation output

### `omg prd next`

```bash
omg prd next [--file <path>] [--json]
```

- Prints highest-priority incomplete story (or `null` when all complete)

### `omg prd validate`

```bash
omg prd validate [--file <path>] [--json]
```

- Runs structural validation and returns non-zero when invalid

### `omg prd complete`

```bash
omg prd complete --story <id> [--file <path>] [--criteria '{"AC-...":"PASS"}'] [--notes "<text>"] [--allow-criteria-bypass] [--json]
```

- Marks story complete only when all acceptance criteria pass
- `--criteria` accepts JSON map of `criterionId -> PASS|FAIL|UNKNOWN|true|false`
- `--allow-criteria-bypass` is explicit escape hatch for non-strict/manual transitions

### `omg prd reopen`

```bash
omg prd reopen --story <id> [--file <path>] [--notes "<text>"] [--json]
```

- Marks story `passes=false` and optionally attaches notes
