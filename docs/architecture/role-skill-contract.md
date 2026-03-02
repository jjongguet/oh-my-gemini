# Role/Skill Mapping Contract (v1)

This document defines the deterministic role/skill routing contract used by the
subagents backend.

## Canonical skills

- `plan`
- `team`
- `review`
- `verify`
- `handoff`

## Primary role mapping

| Skill | Primary role |
|---|---|
| `plan` | `planner` |
| `team` | `executor` |
| `review` | `code-reviewer` |
| `verify` | `verifier` |
| `handoff` | `writer` |

## Fallback order (when primary role is unavailable)

- `plan`: `analyst`, `architect`, `explore`, `scientist`
- `team`: `deep-executor`, `build-fixer`, `debugger`, `designer`
- `review`: `quality-reviewer`, `critic`, `security-reviewer`, `code-simplifier`
- `verify`: `qa-tester`, `test-engineer`
- `handoff`: `document-specialist`, `git-master`

## Catalog extension points

Catalog entries can declare:

- `aliases`: additional tokens that resolve to the role id
- `skills`: explicit skill tokens owned by the role

Both fields are normalized to canonical slug tokens. Conflicting token owners
within one catalog are rejected at parse time.

## Resolution order

For each requested token:

1. exact role id match
2. catalog token match (`role`, `aliases`, `skills`)
3. built-in canonical skill mapping + fallback order

Selections dedupe by canonical role id and preserve first-match order.
