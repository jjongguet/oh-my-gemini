# `omg` Command Quick Reference

> `oh-my-gemini` and `omg` are equivalent CLI entry points.

## `omg setup`

```bash
omg setup [--scope <project|user>] [--dry-run] [--json]
```

- Persists setup scope precedence:
  `--scope` > `.omg/setup-scope.json` > default `project`
- Provisions managed setup artifacts (including `.gemini/agents/catalog.json`)

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
- Auto-switches to `subagents` when subagent tags/flags are used
- Worker range contract: `1..8`

## `omg verify`

```bash
omg verify [--suite typecheck,smoke,integration,reliability] [--dry-run] [--json]
```

Default suites:

- `typecheck`
- `smoke`
- `integration`
- `reliability`
