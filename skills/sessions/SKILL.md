---
name: sessions
aliases: ["/sessions", "session history", "list sessions", "recent sessions"]
primaryRole: coordinator
description: "Inspect and summarize past omg session history including run identifiers, status, timestamps, and artifacts. Use when the user asks 'show history', 'what did I run', 'previous sessions', 'past runs', or wants to resume or review a prior orchestration session."
---

# Sessions Skill (oh-my-gemini)

Use this skill when the user wants to inspect prior runs, review session logs, or find a resumable session.

## Primary command

```bash
omg sessions
```

## Workflow

1. **List sessions** — run `omg sessions` to display recent run history.
2. **Identify the target** — locate the session by ID, timestamp, or status.
3. **Inspect details** — review artifacts, duration, and completion status.
4. **Take action** — resume an incomplete session or reference artifacts from a completed one.

## Expected output

```
Session ID   Status      Started              Duration   Task
─────────────────────────────────────────────────────────────────
abc-1234     completed   2025-03-15 14:30:00  12m 34s    review src/team lifecycle
def-5678     failed      2025-03-15 15:10:00  3m 12s     smoke test hud-setup
ghi-9012     running     2025-03-15 15:45:00  —          integration run
```

## Follow-up actions

- **Resume a session**: `omg team resume --team <name>`
- **View session artifacts**: check `.omg/state/` for run metadata and reports
- **Get team status**: `omg team status --team <name> --json`

## Related surfaces

- `/omg:cost` — token usage and spend for sessions
- `/omg:hud` — live monitoring dashboard
- `/omg:status` — current orchestration state

Task: {{ARGUMENTS}}
