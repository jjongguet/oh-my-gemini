# oh-my-gemini Extension Context

This extension is the canonical public entry point for the `oh-my-gemini` workflow.

## Product intent
- Keep orchestration incremental (MVP-first).
- Default runtime backend is **tmux**.
- Subagents are **experimental opt-in** only.
- Setup defaults to **project scope**.

## Preferred command flow
1. `omg setup --scope project`
2. `bash scripts/setup-subagents.sh` (or `npm run setup:subagents`)
3. `omg doctor`
4. `omg team run --task "..."`
5. `omg verify`
6. Optional live team bridge: `omx team 3:executor "..."`

## Guardrails
- Do not skip sandbox checks when a task requires shell execution.
- Prefer actionable failure output (what failed + how to fix it).
- Keep state transitions observable under `.omg/state/`.

## Handoff expectations
When executing team tasks, include:
- command(s) run,
- final exit status,
- key state/log paths for follow-up.
