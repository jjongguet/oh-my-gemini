<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# tools

## Purpose
Core OMG tool registry plus execution/file tool implementations and adapters for Gemini and MCP surfaces.

## Key Files

| File | Description |
|------|-------------|
| `default-registry.ts` | Builds the default OMG and Gemini tool registries. |
| `exec-tools.ts` | Command execution tools and argument normalization. |
| `file-tools.ts` | File listing/read/write tools. |
| `registry.ts` | Core OMG tool registry implementation. |
| `mcp-adapter.ts` | Adapter that converts OMG tools to MCP tool definitions. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep request/response normalization centralized and register new tools through the shared registry abstractions.
- Preserve stable tool names and schemas because they surface through CLI, MCP, and Gemini adapters.

### Testing Requirements
- Run `npm run typecheck` and targeted tool registry tests when tool contracts or adapters change.

### Common Patterns
- Typed tool definitions, registry-based lookup, and adapter layers for Gemini/MCP exposure.

## Dependencies

### Internal
- Integrates with `src/mcp`, runtime process helpers, and CLI-facing tool serving.

### External
- Node filesystem/path utilities and process execution.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
