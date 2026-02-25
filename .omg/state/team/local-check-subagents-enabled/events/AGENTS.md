<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:32:43Z | Updated: 2026-02-25T05:32:43Z -->

# events

## Purpose
Chronological transition event log for team namespace `local-check-subagents-enabled`.

## Key Files

| File | Description |
|------|-------------|
| `phase-transitions.ndjson` | NDJSON stream of lifecycle transitions (`from`, `to`, timestamps, reason, metadata). |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Treat this log as append-only historical evidence.
- Prefer parsing line-by-line NDJSON rather than assuming bounded file size.

### Testing Requirements
- Verify new lifecycle behavior by asserting expected `to` phases appear in this log.

### Common Patterns
- Multiple runs append multiple transition sequences; entries are keyed by `runId`.

## Dependencies

### Internal
- Written via `TeamStateStore.appendPhaseTransition(...)`.

### External
- None.

<!-- MANUAL: -->
