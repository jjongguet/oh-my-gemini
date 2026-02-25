<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-25T05:26:01Z -->

# testing

## Purpose
Defines acceptance gates and operational test runbooks for both automated verification and live team lifecycle checks.

## Key Files

| File | Description |
|------|-------------|
| `gates.md` | Required commands + pass/fail criteria for Gate 1A/1B/2. |
| `live-team-e2e.md` | Operator runbook for live `omx team` lifecycle validation in tmux. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep gate criteria measurable and command-driven.
- Ensure any new test suite additions are reflected in gate docs.

### Testing Requirements
- Execute documented commands (or targeted subset) after editing criteria.

### Common Patterns
- Gate docs distinguish scaffold checks, deterministic reliability checks, and optional live operator checks.

## Dependencies

### Internal
- Matches suite organization under `tests/` and scripts in `scripts/`.

### External
- `omx`, `tmux`, and local shell tooling for live operator runbooks.

<!-- MANUAL: -->
