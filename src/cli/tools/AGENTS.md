<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# tools

## Purpose
CLI-exposed file, git, HTTP, and process tool registry used for extension-facing MCP serving and command discovery.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Builds the CLI tool registry and Gemini-extension MCP server config. |
| `server.ts` | Wraps the CLI tool registry in an `OmgMcpServer` for stdio serving. |
| `types.ts` | Tool-category and descriptor contracts for CLI tools. |
| `common.ts` | Shared parsing and tool result helpers. |
| `file-tools.ts` | File listing and file-read/write helpers. |
| `git-tools.ts` | Git-focused CLI tools. |
| `http-tools.ts` | HTTP request and inspection tools. |
| `process-tools.ts` | Process execution and inspection tools. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep tool schemas, categories, and returned payload shapes stable because they are consumed through CLI and MCP boundaries.
- Reuse shared helper utilities in `common.ts` instead of duplicating parsing or result-format logic.

### Testing Requirements
- Run targeted CLI tool or MCP integration tests whenever tool contracts or served categories change.
- At minimum run `npm run typecheck` after editing this directory.

### Common Patterns
- Factory functions return arrays of typed tool definitions grouped by category.
- The CLI-facing registry is separate from the lower-level tool registry in `src/tools/` but mirrors similar categories.

## Dependencies

### Internal
- Builds on `src/mcp/server.ts` and complements the core registries under `src/tools/`.

### External
- Node filesystem, process, networking, and git shell integration.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
