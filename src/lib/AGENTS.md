<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# lib

## Purpose
Foundational low-level utilities for atomic writes, locks, mode-state IO, payload limits, session isolation, shared memory, versioning, and worktree-safe path handling.

## Key Files

| File | Description |
|------|-------------|
| `atomic-write.ts` | Atomic and durable file-write helpers. |
| `file-lock.ts` | Advisory lock acquisition and stale-lock handling. |
| `mode-state-io.ts` | Canonical mode state read/write/clear helpers. |
| `shared-memory.ts` | Filesystem-backed shared key/value memory. |
| `worktree-paths.ts` | Worktree-aware path resolution and enforcement for OMG state files. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Treat these modules as foundational primitives and avoid duplicating their behavior elsewhere.
- Preserve safety properties such as atomic writes, path validation, and worktree scoping.

### Testing Requirements
- Run `npm run typecheck` and targeted durability/locking/path tests when touching this directory.

### Common Patterns
- Self-contained utility modules with explicit filesystem and process semantics reused across many subsystems.

## Dependencies

### Internal
- Used heavily by hooks, modes, state, team orchestration, and related runtime helpers.

### External
- Node filesystem, OS, crypto, URL, and process APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
