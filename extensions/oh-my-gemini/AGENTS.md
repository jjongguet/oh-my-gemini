<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# oh-my-gemini

## Purpose
Implements the `oh-my-gemini` extension package metadata and context used by Gemini CLI when the extension is linked.

## Key Files

| File | Description |
|------|-------------|
| `gemini-extension.json` | Extension manifest (name, version, description, context file). |
| `GEMINI.md` | Canonical extension context, flow, and guardrails. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Prompt templates for setup/doctor/team/verify command entrypoints. See `commands/AGENTS.md`. |
| `skills/` | Extension-specific skills for planning workflows. See `skills/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Keep prompts concise, actionable, and aligned with real CLI flags/scripts.
- Preserve extension-first language and ordering from roadmap intent.

### Testing Requirements
- Validate prompt examples against local commands (`npm run omg -- ...`).
- Re-link extension (`gemini extensions link ./extensions/oh-my-gemini`) when testing end-to-end.

### Common Patterns
- Command prompt files use `{{args}}` interpolation and deterministic action/report sections.

## Dependencies

### Internal
- References root scripts, CLI commands, and state artifact paths.

### External
- Gemini extension command/skill invocation mechanics.

<!-- MANUAL: -->
