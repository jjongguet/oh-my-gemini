<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# extensions

## Purpose
Contains Gemini extension packages that expose project workflows through extension-first command/skill interfaces.

## Key Files
No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `oh-my-gemini/` | Canonical extension package for this repository. See `oh-my-gemini/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Treat extension prompts as user-facing UX contracts.
- Keep extension metadata and prompt instructions synchronized with CLI capabilities.

### Testing Requirements
- After edits, link/test extension commands in a local Gemini CLI environment when possible.

### Common Patterns
- Extension structure follows: `gemini-extension.json`, context file, command prompt specs, optional skills.

## Dependencies

### Internal
- Delegates execution to repository CLI (`npm run omg -- ...`) and scripts.

### External
- Gemini extension runtime.

<!-- MANUAL: -->
