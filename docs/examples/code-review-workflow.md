# Example: Multi-worker code review workflow

This walkthrough shows how to run a practical code review using `omp team run`, monitor it, and clean up the run state afterward.

## When to use this

Use this flow when you want several workers to review a risky change set in parallel—for example `src/team/`, `src/cli/`, and the related tests before merge.

## Prerequisites

Run the normal local setup first:

```bash
npm install
npm run setup
npm run doctor
```

## 1) Preview the run configuration

Start with a dry-run so you can confirm the worker count and resolved runtime settings before tmux panes are launched.

```bash
npm run omp -- team run \
  --task "review src/team, src/cli, and tests for correctness, reliability, and missing coverage" \
  --workers 4 \
  --dry-run \
  --json
```

## 2) Launch the review workers

```bash
npm run omp -- team run \
  --task "review src/team, src/cli, and tests for correctness, reliability, and missing coverage" \
  --workers 4
```

The default backend is `tmux`, so this will start a local orchestration run and persist state under `.omp/state/team/oh-my-product/`. If you launch the run with a non-default `--team` value, reuse that same team name for every `hud`, `status`, `resume`, and `shutdown` command that follows.

## 3) Watch the run in real time

Open the focused HUD view in one terminal:

```bash
npm run omp -- hud --team oh-my-product --preset focused
```

Or continuously refresh it while the workers run:

```bash
npm run omp -- hud --watch --interval-ms 1000
```

If you want a JSON snapshot for scripting or debugging:

```bash
npm run omp -- team status --team oh-my-product --json
```

## 4) Retry or resume if the run needs one more pass

If the review surfaced fixable issues and you want to give the team one more iteration:

```bash
npm run omp -- team resume --team oh-my-product --max-fix-loop 1
```

If you only want to inspect what would be resumed, use:

```bash
npm run omp -- team resume --team oh-my-product --dry-run --json
```

## 5) Shut the run down cleanly

When you are done collecting the review output, stop the runtime and leave state in a known place:

```bash
npm run omp -- team shutdown --team oh-my-product --force --json
```

## 6) Record the findings in your PR

A lightweight manual pattern that works well is:

```text
## Review summary
- correctness:
- reliability:
- test gaps:
- follow-up:
```

Pair that summary with the exact commands you ran:

```text
npm run omp -- team run --task "review src/team, src/cli, and tests for correctness, reliability, and missing coverage" --workers 4
npm run omp -- hud --watch --interval-ms 1000
npm run omp -- team status --team oh-my-product --json
```
