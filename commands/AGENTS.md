<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# commands

## Purpose
Top-level container for Gemini extension command prompt bundles. This directory is part of the packaged public UX and groups command templates by product or namespace.

## Key Files

No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `omg/` | Command prompt assets for the `oh-my-gemini` extension package (see `omg/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep command bundle names and directory structure aligned with `gemini-extension.json` and the packaged extension layout.
- Treat prompt text here as public UX: command names, examples, and expected outputs should match the actual CLI behavior.

### Testing Requirements
- Validate referenced prompt assets are included by the extension packaging flow and resolve through the command-template helpers.
- When prompt commands change, verify the corresponding CLI command or docs example still exists.

### Common Patterns
- Each namespace contains TOML prompt templates rather than implementation logic.
- Behavioral details should mirror `src/commands` and `src/cli/commands`, not diverge from them.

## Dependencies

### Internal
- `commands/omg/**` defines the packaged prompt surface used by extension command lookup and expansion.

### External
- Gemini extension command-loading conventions.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
