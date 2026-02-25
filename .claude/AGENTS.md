<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# .claude

## Purpose
Contains local Claude configuration for this repository, including enabled MCP servers and project-level server behavior flags.

## Key Files

| File | Description |
|------|-------------|
| `settings.local.json` | Local machine/project settings for Claude integrations (MCP server enablement and behavior). |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Prefer additive, minimal edits.
- Avoid committing user-specific secrets or machine-local absolute paths.

### Testing Requirements
- Validate JSON syntax after edits.
- Confirm required MCP entries remain present when modifying server lists.

### Common Patterns
- Settings are represented as a single JSON object with explicit boolean feature toggles.

## Dependencies

### Internal
- Indirectly complements local workflows for this repository; not consumed by runtime TypeScript code.

### External
- Claude client tooling and MCP-compatible local integrations.

<!-- MANUAL: -->
