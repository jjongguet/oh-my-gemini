---
name: team
aliases: ["/team", "team run", "run team"]
primaryRole: orchestrator
description: Orchestrate parallel tmux workers for a multi-agent team task.
---

# Team Skill (oh-my-gemini)

Use this skill when the user wants to run a multi-worker team orchestration task.

## What it does

Launches `omg team run` with the specified task and worker count, creating a tmux session with N parallel workers. Each worker receives the team context via GEMINI.md and executes the task, then writes a completion signal.

## Usage

```
omg team run --task "<task description>" --workers <N>
```

## Examples

- `omg team run --task "Review all PRs" --workers 3`
- `omg team run --task "Run smoke tests" --workers 2`
- `omg team run --task "Audit dependencies" --workers 4`

## Orchestration steps

1. Hook system writes team context to `.gemini/GEMINI.md`
2. tmux session is created with N worker panes
3. Each worker runs `omg worker run --team <name> --worker <id>`
4. Workers read context, execute task, write done signal to state
5. Orchestrator polls until all workers complete
6. Results aggregated and displayed

## Acceptance criteria

- [ ] tmux session created with N panes
- [ ] Each pane executes the worker run command
- [ ] Each worker writes a done signal (`.omg/state/team/<name>/workers/<id>/done.json`)
- [ ] `omg team status` reflects worker completion
