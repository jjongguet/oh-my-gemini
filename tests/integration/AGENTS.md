<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# integration

## Purpose
Validates multi-module command flows and persisted lifecycle artifacts under realistic execution scenarios.

## Key Files

| File | Description |
|------|-------------|
| `team-lifecycle.test.ts` | Runs integration script path for standard team lifecycle. |
| `subagents-team-run.test.ts` | End-to-end subagents backend execution and keyword assignment behavior. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep integration tests explicit about environment preconditions and skip logic.
- Assert both command-level outputs and filesystem artifacts under `.omg/state`.

### Testing Requirements
- Run `npm run test:integration` after edits.
- For subagents path updates, also run `npm run test:reliability`.

### Common Patterns
- Seed temporary `.gemini/settings.json` + subagent catalog in temp dirs.
- Parse JSON output defensively from CLI stdout.

## Dependencies

### Internal
- Exercises `src/cli`, `src/team`, and shell scripts in `scripts/`.

### External
- tmux/gemini availability gates for certain live-adjacent paths.

<!-- MANUAL: -->
