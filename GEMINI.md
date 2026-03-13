# oh-my-gemini Extension Context

This extension is the canonical public entry point for the `oh-my-gemini` workflow.

> **Shared context**: See `context/omg-core.md` for the full agent catalog, workflow stages, quality gates, and state conventions.

## Context Layers (priority order)
1. **System/Runtime** — Gemini CLI constraints (immutable)
2. **Project Standards** — This file (`GEMINI.md`) + `context/omg-core.md`
3. **Session Memory** — `.omg/state/`, memory entries
4. **Active Task** — Current plan, taskboard, PRD
5. **Execution Traces** — Recent iteration results

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

## Discoverability notes
- Gemini's extension install preview may expose skills more visibly than command prompts.
- Preview is not the full feature list: extension command TOML assets can still be installed even when they are not explicitly enumerated during install.
- If preview output looks sparse, verify availability with direct CLI commands instead of relying on the preview screen alone.

Primary command families:
- `setup`
- `doctor`
- `team run` / `team assemble` / `team plan` / `team prd` / `team exec`
- `team subagents`
- `team verify`
- `tools`
- `hud`
- `intent` / `mode` / `approval` / `reasoning`
- `workspace` / `taskboard` / `checkpoint`
- `ralph` / `ultrawork` / `loop`
- `consensus` / `optimize` / `memory` / `rules`
- `launch` / `stop`

## Guardrails
- Do not skip sandbox checks when a task requires shell execution.
- Prefer actionable failure output (what failed + how to fix it).
- Keep state transitions observable under `.omg/state/`.

## Handoff expectations
When executing team tasks, include:
- command(s) run,
- final exit status,
- key state/log paths for follow-up.
