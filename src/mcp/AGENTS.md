<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# mcp

## Purpose
OMG-specific MCP server/client implementation and type contracts for serving tools, prompts, and resources.

## Key Files

| File | Description |
|------|-------------|
| `server.ts` | MCP server wrapper and default OMG server builder. |
| `client.ts` | stdio MCP client wrapper. |
| `types.ts` | OMG MCP type aliases and prompt/resource/tool contracts. |
| `index.ts` | Public MCP exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep wire contracts stable and adapt OMG internals at the boundary rather than leaking implementation-specific types outward.
- Preserve stdio transport assumptions unless server/client behavior is intentionally changed.

### Testing Requirements
- Run `npm run typecheck` and targeted MCP integration tests when server/client contracts change.

### Common Patterns
- Typed wrapper around MCP SDK primitives with default server/client builders.

## Dependencies

### Internal
- Integrates with `src/tools`, `src/interop`, `src/skills`, `src/state`, and `src/team/control-plane`.

### External
- `@modelcontextprotocol/sdk` and Node filesystem/path utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
