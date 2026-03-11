<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# features

## Purpose
Thin feature-system facade that re-exports the OMG-native `commands`, `config`, and `platform` modules.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Namespaced facade that groups core feature modules. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep this directory as a stable aggregation layer; put behavior in the underlying feature modules instead.

### Testing Requirements
- `npm run typecheck` is usually sufficient unless you alter the exported feature boundaries.

### Common Patterns
- Small re-export facade with no business logic.

## Dependencies

### Internal
- Re-exports `src/commands`, `src/config`, and `src/platform`.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
