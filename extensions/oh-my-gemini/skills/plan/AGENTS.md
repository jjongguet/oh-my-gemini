<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# plan

## Purpose
Defines the extension planning skill used to generate phased execution plans mapped to the `oh-my-gemini` roadmap gates.

## Key Files

| File | Description |
|------|-------------|
| `SKILL.md` | Planning workflow template with objective clarification, phase mapping, sequencing, and verification output format. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep gate references and phase names synchronized with current roadmap docs.
- Favor explicit milestones, risks, and command-level verification.

### Testing Requirements
- Manual validation: invoke the skill and ensure output structure still matches documented template.

### Common Patterns
- Five-step planning framework ending with concise milestone/risk/verification output.

## Dependencies

### Internal
- References `docs/testing/gates.md` and roadmap artifacts under `.omx/plans/`.

### External
- Gemini skill runtime.

<!-- MANUAL: -->
