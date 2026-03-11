<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# agents

## Purpose
Agent definitions, prompt metadata, prompt-loading helpers, and registry exports used by the orchestrator and specialized role workflows.

## Key Files

| File | Description |
|------|-------------|
| `definitions.ts` | Central registry/re-export layer plus tiered agent definitions. |
| `types.ts` | Shared agent config, prompt metadata, and model-tier types. |
| `utils.ts` | Prompt-loading, validation, and agent utility helpers. |
| `prompt-helpers.ts` | Prompt injection helpers for external model and tool calls. |
| `index.ts` | Public export surface for agent types, helpers, and definitions. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Add new agents as standalone files and wire them through `definitions.ts` and `index.ts`.
- Keep prompt metadata aligned with actual prompt files and exported agent names.
- Prefer shared helpers in `utils.ts` and `prompt-helpers.ts` over duplicating prompt-loading logic.

### Testing Requirements
- Run `npm run typecheck` and any targeted registry/prompt-resolution tests when changing agent definitions.

### Common Patterns
- One agent per file with prompt metadata exports.
- `definitions.ts` is the canonical aggregation point.

## Dependencies

### Internal
- Consumed by orchestration, worker prompts, and role-selection logic across the repository.

### External
- Node filesystem/path utilities for prompt discovery and loading.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
