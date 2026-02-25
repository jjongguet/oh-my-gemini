<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# runtime

## Purpose
Implements runtime backend adapters behind a shared contract, plus backend registry and subprocess utilities.

## Key Files

| File | Description |
|------|-------------|
| `runtime-backend.ts` | Runtime backend interface and backend-name typing. |
| `backend-registry.ts` | Registry abstraction and default backend registration. |
| `tmux-backend.ts` | Default tmux session-based team runtime implementation. |
| `subagents-backend.ts` | Experimental deterministic subagents backend with catalog-driven role selection. |
| `process-utils.ts` | Subprocess wrappers and shell escaping helpers. |
| `index.ts` | Runtime module exports. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Preserve backend contract shape; orchestrator depends on stable methods and status semantics.
- Keep tmux interactions resilient and produce actionable failure messages.
- For subagents backend, enforce explicit experimental opt-in and catalog validation.

### Testing Requirements
- Run reliability suites for backend behavior and orchestrator interactions:
  - `npm run test:reliability`
  - `npm run test:integration`

### Common Patterns
- `probePrerequisites` gating before `startTeam`.
- `monitorTeam` returns normalized `TeamSnapshot` with runtime metadata.

## Dependencies

### Internal
- Consumed by `src/team/team-orchestrator.ts`; uses `src/team/subagents-catalog.ts`.

### External
- tmux CLI and process spawning for runtime operations.

<!-- MANUAL: -->
