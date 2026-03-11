<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# plugins

## Purpose
npm plugin discovery, loading, and runtime-backend registry integration for OMG extensibility.

## Key Files

| File | Description |
|------|-------------|
| `loader.ts` | Discovers and dynamically loads OMG plugins. |
| `registry.ts` | Builds plugin-backed runtime backend registries. |
| `types.ts` | Plugin env vars, discovery sources, and manifest contracts. |
| `index.ts` | Public plugin exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Preserve plugin isolation and explicit enablement via env/config rather than surprising auto-load behavior.
- Keep duplicate-backend and duplicate-plugin detection strict.

### Testing Requirements
- Run `npm run typecheck` and targeted plugin discovery/registry tests when plugin behavior changes.

### Common Patterns
- Discover candidates -> load modules -> validate manifests -> register runtime backends.

## Dependencies

### Internal
- Integrates with `src/team/runtime` and feature-level loading surfaces.

### External
- Node filesystem, module-loading, path, and URL APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
