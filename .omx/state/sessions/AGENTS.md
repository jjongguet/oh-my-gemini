<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:32:43Z | Updated: 2026-02-25T05:32:43Z -->

# sessions

## Purpose
Container for session-scoped OMX state directories. Each child directory corresponds to one session ID.

## Key Files
No direct files at this level.

## Subdirectories
- Session folders named `omx-<timestamp>-<suffix>/` containing session-specific state/context artifacts.

## For AI Agents

### Working In This Directory
- Treat child directories as ephemeral runtime capsules.
- Preserve existing session context documents if present (especially runtime-injected metadata blocks).

### Testing Requirements
- Session directories are typically validated indirectly through OMX status/trace tools rather than direct unit tests.

### Common Patterns
- Some sessions are empty placeholders; others contain specific state files (for example `plan-state.json`).

## Dependencies

### Internal
- Populated by OMX runtime session bootstrap logic.

### External
- None.

<!-- MANUAL: -->
