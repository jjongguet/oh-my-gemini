<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# prd

## Purpose
PRD parsing, validation, and workflow helpers used to turn structured product requirements into actionable runtime inputs.

## Key Files

| File | Description |
|------|-------------|
| `parser.ts` | Parses PRD data and reports parse issues. |
| `validator.ts` | Validates documents, stories, and acceptance criteria. |
| `workflow.ts` | Higher-level PRD workflow helpers. |
| `index.ts` | Public PRD exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep parser defaults and validator failures explicit; do not silently accept malformed PRD input.

### Testing Requirements
- Run `npm run typecheck` and targeted parser/validator tests when PRD handling changes.

### Common Patterns
- Parse -> validate -> workflow summary/result.

## Dependencies

### Internal
- Used by CLI commands and automation flows that consume structured PRD inputs.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
