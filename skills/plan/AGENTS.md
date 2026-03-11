<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# plan

## Purpose
Defines the packaged planning skill used to turn a request into phased execution, acceptance gates, sequencing, and rollback-aware verification steps.

## Key Files

| File | Description |
|------|-------------|
| `SKILL.md` | Planning workflow template with objective clarification, phase mapping, sequencing, and verification output format. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep gate references and phase names synchronized with current canonical docs under `docs/planning/` and `docs/testing/`.
- Favor explicit milestones, risks, rollback points, and command-level verification steps.

### Testing Requirements
- Manual validation: invoke the skill path or inspect examples to ensure the output structure still matches the documented planning template.

### Common Patterns
- Five-step planning framework ending with concise milestones, risks, and verification output.

## Dependencies

### Internal
- References canonical planning docs under `docs/planning/` and gates under `docs/testing/`.
- Should remain consistent with `commands/` and the implementation capabilities exposed by `src/cli` and `src/team`.

### External
- Gemini skill runtime.

<!-- MANUAL: -->
