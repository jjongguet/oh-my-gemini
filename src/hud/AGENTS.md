<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# hud

## Purpose
Terminal HUD rendering, configuration loading, and runtime status aggregation for OMG sessions and teams.

## Key Files

| File | Description |
|------|-------------|
| `render.ts` | HUD element rendering and display sanitization. |
| `state.ts` | HUD config/context loading and state aggregation. |
| `types.ts` | HUD config and render context types. |
| `colors.ts` | ANSI color helpers used by the renderer. |
| `index.ts` | Public HUD exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep rendering side effects out of `render.ts`; compute state in `state.ts` and format it separately.
- Preserve text sanitization for dynamic content before rendering to the terminal.

### Testing Requirements
- Run `npm run typecheck` and targeted HUD render/state tests when output or config behavior changes.

### Common Patterns
- Load config/context -> build typed HUD context -> render preset-specific output.

## Dependencies

### Internal
- Uses `src/common/team-name`, `src/state`, and local HUD types/helpers.

### External
- Node child-process, filesystem, OS, and path APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
