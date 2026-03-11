# oh-my-gemini Extension Context

This extension is the canonical public entry point for the `oh-my-gemini` workflow.

## Product intent
- Keep orchestration incremental (MVP-first).
- Default runtime backend is **tmux**.
- Subagents are **experimental opt-in** only.
- Setup defaults to **project scope**.

## Preferred command flow
1. `oh-my-gemini setup --scope project` (alias: `omg setup --scope project`)
2. ensure `.gemini/agents/catalog.json` exists (repo contributor fallback: `npm run setup:subagents`)
3. `oh-my-gemini doctor`
4. `oh-my-gemini team run --task "..."`
5. `oh-my-gemini verify`
6. Optional MCP server surface: `oh-my-gemini mcp serve --dry-run --json`
7. Optional live team bridge: `omx team 3:executor "..."`

## Guardrails
- Do not skip sandbox checks when a task requires shell execution.
- Prefer actionable failure output (what failed + how to fix it).
- Keep state transitions observable under `.omg/state/`.

## Handoff expectations
When executing team tasks, include:
- command(s) run,
- final exit status,
- key state/log paths for follow-up.
