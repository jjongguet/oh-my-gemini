<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# shared

## Purpose
Small cross-domain shared-type export surface used by multiple subsystems.

## Key Files

| File | Description |
|------|-------------|
| `types.ts` | Shared model, agent, plugin, and session-related type contracts. |
| `index.ts` | Re-export surface for shared types. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep this directory narrow; only place genuinely cross-cutting types here.

### Testing Requirements
- `npm run typecheck` is the primary validation for changes here.

### Common Patterns
- `types.ts` plus a small barrel export.

## Dependencies

### Internal
- Imported by multiple source subsystems that need common type contracts.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
