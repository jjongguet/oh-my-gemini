<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:32:43Z | Updated: 2026-02-25T05:32:43Z -->

# logs

## Purpose
Append-only operational logs for OMX hooks, notifications, turns, and session history.

## Key Files

| File | Description |
|------|-------------|
| `hooks-<date>.jsonl` | Hook invocation activity logs. |
| `tmux-hook-<date>.jsonl` | TMUX hook injection events and outcomes. |
| `notify-fallback-<date>.jsonl` | Notification fallback logging stream. |
| `turns-<date>.jsonl` | Agent turn-level timeline stream. |
| `session-history.jsonl` | Cross-session event timeline. |
| `omx-<date>.jsonl` | General OMX runtime event log stream. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Preserve JSONL format: one valid JSON object per line.
- Avoid manual edits unless redaction/forensics task explicitly requires it.

### Testing Requirements
- If log schema changes in code, validate downstream parsers/tools still work.

### Common Patterns
- Date-partitioned files with high append frequency.

## Dependencies

### Internal
- Written by OMX hook and runtime subsystems.

### External
- None.

<!-- MANUAL: -->
