<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# commands

## Purpose
Defines packaged extension command prompts that translate user intent into concrete `oh-my-gemini` CLI or script actions.

## Key Files

| File | Description |
|------|-------------|
| `setup.toml` | Setup workflow prompt for installing or refreshing managed Gemini assets. |
| `doctor.toml` | Diagnostic prompt for prerequisite and environment checks. |
| `hud.toml` | HUD-focused prompt for rendering or configuring the status surface. |
| `mcp.toml` | Prompt for working with OMG MCP server/client surfaces. |
| `tools.toml` | Prompt for listing or serving the packaged CLI tool registry. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `team/` | Team-run, live, subagents, and verify prompts for orchestration flows (see `team/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Ensure prompts use exact current command names, flags, and expected artifact paths.
- Keep failure handling concise and operational rather than speculative.
- When adding a new packaged command here, make sure it is also discoverable through the command-template loader and extension manifest.

### Testing Requirements
- Execute referenced commands locally or in dry-run form when possible to confirm they still exist and produce the documented outputs.
- If prompt behavior changes, verify `src/commands/index.ts` can still resolve and expand the corresponding TOML asset.

### Common Patterns
- TOML prompt bodies are imperative checklists with expected summary/reporting sections.
- Namespace-specific prompts live in subdirectories such as `team/`.

## Dependencies

### Internal
- Uses the CLI surfaces implemented under `src/cli/commands/**`.
- Resolved and expanded by `src/commands/index.ts` and related extension-path helpers.

### External
- Gemini extension prompt execution.

<!-- MANUAL: -->
