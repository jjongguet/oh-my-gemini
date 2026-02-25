<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:32:43Z | Updated: 2026-02-25T05:32:43Z -->

# state

## Purpose
OMX mode/runtime state snapshots for the current workspace, including session identity, mode states, and automation hooks.

## Key Files

| File | Description |
|------|-------------|
| `session.json` | Current session ID, start timestamp, and workspace metadata. |
| `team-state.json` | High-level team-mode execution state. |
| `team-execution-state.json` | Additional execution checkpoint details for team runs. |
| `implementation-progress-state.json` | Progress snapshots for long-running implementation tracks. |
| `hud-state.json` | HUD/statusline state persistence. |
| `notify-hook-state.json` | Notification hook runtime state. |
| `notify-fallback-state.json` | Fallback notifier state. |
| `tmux-hook-state.json` | TMUX hook runtime state. |
| `auto-nudge-state.json` | Auto-nudge subsystem state. |
| `update-check.json` | Tooling update-check cache/state. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `sessions/` | Session-scoped state directories and context capsules. See `sessions/AGENTS.md`. |
| `team/` | Team-state workspace root (may be empty depending on run mode). |

## For AI Agents

### Working In This Directory
- Prefer writing via OMX state tools/processes; manual edits can desynchronize live state.
- Handle missing optional state files gracefully.

### Testing Requirements
- Validate relevant OMX mode commands after any intentional state-shape updates.

### Common Patterns
- Flat JSON state files plus session-scoped subdirectories for per-session context.

## Dependencies

### Internal
- Managed by OMX runtime orchestration, mode controllers, and hooks.

### External
- None.

<!-- MANUAL: -->
