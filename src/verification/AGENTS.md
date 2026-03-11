<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# verification

## Purpose
Verification-tier selection, suite execution, and assertion helpers that power OMG verification workflows.

## Key Files

| File | Description |
|------|-------------|
| `tier-selector.ts` | Change metadata inspection plus verification tier/agent selection. |
| `test-runner.ts` | Verification suite execution and result aggregation. |
| `assertions.ts` | Assertions over verification reports and expected suite behavior. |
| `index.ts` | Public verification exports. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep tier selection deterministic and avoid hidden escalation rules that differ from the documented verification model.
- Preserve explicit command strings because tests assert on them.

### Testing Requirements
- Run `npm run typecheck` and targeted verification tests when suite lists, tiers, or report formats change.

### Common Patterns
- Derive change metadata -> choose verification tier/agent -> run suites -> assert report expectations.

## Dependencies

### Internal
- Used by CLI verify flows and related docs/tests.

### External
- Node child-process execution for running verification commands.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
