<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# config

## Purpose
Configuration loading, built-in model defaults, and config schema/type definitions for OMG runtime behavior.

## Key Files

| File | Description |
|------|-------------|
| `loader.ts` | Configuration loading and default external-model resolution. |
| `models.ts` | Built-in model aliases and tier defaults. |
| `types.ts` | Configuration schema, routing, and model-tier types. |
| `index.ts` | Public export surface for config utilities and types. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep environment and filesystem config resolution deterministic and explicit.
- Update `models.ts` and `types.ts` together when tier or routing semantics change.

### Testing Requirements
- Run `npm run typecheck` and targeted config parsing/default-resolution tests after changes.

### Common Patterns
- Separate raw loading (`loader.ts`) from constants (`models.ts`) and type contracts (`types.ts`).

## Dependencies

### Internal
- Used by providers, routing, and feature-layer entrypoints.

### External
- Node filesystem, OS, and path utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
