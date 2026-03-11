<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# hooks

## Purpose
Hook pipeline, shared hook types, worker context IO, and lifecycle/mode helper modules for routing prompts, persisting memory, and handling recovery or session transitions.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Hook registry, ordering, result merge, and pipeline execution. |
| `types.ts` | Hook event, context, and result contracts. |
| `context-reader.ts` | Reads team context from `.gemini/GEMINI.md`. |
| `context-writer.ts` | Builds and writes worker context with truncation safeguards. |
| `keyword-hook.ts` | Top-level keyword-routing hook entrypoint. |
| `recovery-hook.ts` | Top-level recovery-classification hook entrypoint. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `autopilot/` | Autopilot activation hook adapter (see `autopilot/AGENTS.md`). |
| `keyword-detector/` | Prompt sanitization and mode-keyword routing (see `keyword-detector/AGENTS.md`). |
| `learner/` | Learned-skill persistence hooks (see `learner/AGENTS.md`). |
| `mode-registry/` | Execution-mode registration and active-state helpers (see `mode-registry/AGENTS.md`). |
| `permission-handler/` | Permission-request screening hook helpers (see `permission-handler/AGENTS.md`). |
| `pre-compact/` | Pre-compaction checkpoint hook (see `pre-compact/AGENTS.md`). |
| `project-memory/` | Persistent project-memory hooks (see `project-memory/AGENTS.md`). |
| `ralph/` | Ralph activation hook adapter (see `ralph/AGENTS.md`). |
| `recovery/` | Recovery classification and retry helpers (see `recovery/AGENTS.md`). |
| `session-end/` | Session summary export and cleanup hooks (see `session-end/AGENTS.md`). |
| `subagent-tracker/` | Subagent lifecycle tracking hooks (see `subagent-tracker/AGENTS.md`). |
| `ultrawork/` | Ultrawork activation hook adapter (see `ultrawork/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep hook handlers composable and add new hook-specific logic in a dedicated subdirectory module rather than bloating the root index.
- Preserve `HookContext` and `HookResult` compatibility because multiple subsystems compose through them.
- Route shared persistence through the existing memory/state helpers instead of bespoke files.

### Testing Requirements
- Run `npm run typecheck` and targeted hook-routing or persistence tests for any changed hook behavior.
- Cross-cutting lifecycle or mode changes usually also warrant reliability tests.

### Common Patterns
- `create*Hook()` factories return `RegisteredHook` instances for the central registry.
- Lifecycle, memory, and routing behavior is decomposed into focused subdirectories.

## Dependencies

### Internal
- Closely integrated with `src/modes`, `src/lib`, `src/state`, `src/team`, and `src/skills`.

### External
- Node buffer/filesystem/path helpers where context or checkpoint files are involved.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
