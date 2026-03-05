# PRD Workflow (Ralph-style)

This guide documents the `omg prd` command family for acceptance-criteria driven work.

## Quickstart

```bash
# initialize PRD scaffold
omg prd init --task "implement feature X"

# inspect progress and next story
omg prd status --json
omg prd next --json

# complete story with criterion-level evidence
omg prd complete \
  --story US-001 \
  --criteria '{"AC-US-001-1":"PASS","AC-US-001-2":"PASS","AC-US-001-3":"PASS","AC-US-001-4":"PASS"}' \
  --json

# reopen when rework is needed
omg prd reopen --story US-001 --notes "architect requested changes" --json
```

## File resolution

`omg prd` resolves PRD path in this order:

1. `--file <path>`
2. `./prd.json`
3. `./.omg/prd.json`

## Acceptance criteria evidence format

`--criteria` for `omg prd complete` accepts JSON:

```json
{
  "AC-US-001-1": "PASS",
  "AC-US-001-2": true,
  "AC-US-001-3": "FAIL",
  "AC-US-001-4": "UNKNOWN"
}
```

Supported values:

- `"PASS"` / `true`
- `"FAIL"` / `false`
- `"UNKNOWN"`

By default, story completion is blocked unless all criteria pass.  
Use `--allow-criteria-bypass` only for explicit/manual transitions.

## Contract notes

- PRD structure is validated (`project`, `branchName`, `description`, `userStories`).
- Story completion status uses `passes: boolean`.
- Team orchestration success checklist consumes runtime PRD acceptance contract when `runtime.prd` exists.
