<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# prompts

## Purpose
Markdown prompt templates for specialized worker roles and execution lanes.

## Key Files

| File | Description |
|------|-------------|
| `architect.md` | Architecture-focused worker prompt. |
| `execute.md` | Execution-focused worker prompt. |
| `explore.md` | Exploration and codebase-mapping worker prompt. |
| `review.md` | Review-focused worker prompt. |
| `verify.md` | Verification-focused worker prompt. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep role prompts deterministic, concise, and aligned with the actual capabilities of the agents that load them.

### Testing Requirements
- Validate prompt-loading code paths or related tests when filenames or expected role names change.

### Common Patterns
- One markdown file per role prompt.

## Dependencies

### Internal
- Loaded by agent and worker prompt utilities under `src/agents/`.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
