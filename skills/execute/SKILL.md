---
name: execute
aliases: ["/execute", "run task", "implement now", "do it"]
primaryRole: executor
description: "Execute a concrete implementation task with progress updates and validation evidence. Use when the user says 'implement this', 'build it', 'do it now', 'run the task', or when a plan is finalized and ready for immediate implementation in the oh-my-gemini codebase."
---

# Execute Skill (oh-my-gemini)

Use this skill when the task is clear enough to implement immediately — a plan exists or the requirement is unambiguous.

## Execution policy

- Make reasonable assumptions instead of blocking on minor ambiguity.
- Prefer minimal, coherent changes.
- Validate each change before moving to the next.

## Workflow

1. **State the objective** — confirm what will be implemented in one sentence.
2. **Implement changes** — edit files, keeping diffs small and focused.
3. **Validate** — run the appropriate checks:
   ```bash
   npm run typecheck    # type safety
   npm run test         # unit/integration tests
   npm run verify       # full verification suite
   ```
4. **Fix issues** — if validation fails, fix and re-run before continuing.
5. **Report results** — summarize using the format below.

## Report format

```markdown
## Objective
[One-sentence description of what was implemented]

## Changed files
- `src/cli/foo.ts` — added retry logic for API calls
- `tests/foo.test.ts` — added test for retry behavior

## Validation
- `npm run typecheck` — passed
- `npm run test` — passed (42 tests, 0 failures)

## Result
[What works now that didn't before, or remaining follow-ups]
```

## Example

**Task**: "Add a --json flag to the `omg status` command"

1. Edit `src/cli/status.ts` — add `--json` option to the command parser
2. Update handler to output `JSON.stringify(statusData)` when flag is set
3. Run `npm run typecheck && npm run test`
4. Report: added `--json` to status command, 1 file changed, tests pass

Task: {{ARGUMENTS}}
