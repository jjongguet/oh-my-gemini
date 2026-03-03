# Worker 6: role/skill alias parity slice

Date: 2026-03-02

## Problem slice

`oh-my-gemini` already supported canonical subagent ids like `planner` and
`executor`, but OmX/OmC-style operator flows often use skill-flavored inputs
like `plan`, `execute`, `review`, `verify`, and `handoff`. Without alias-aware
resolution, those inputs either failed or depended on ad-hoc catalog naming.

## What changed

### Code

- Added alias-aware subagent catalog parsing and canonical deduplication:
  - `src/team/subagents-catalog.ts`
- Added default blueprint aliases for the core parity roles:
  - `src/team/subagents-blueprint.ts`
- Persisted alias metadata through subagent runtime restoration/monitoring:
  - `src/team/runtime/subagents-backend.ts`
- Extended the subagent definition type to carry aliases:
  - `src/team/types.ts`

### Tests

- Added catalog alias coverage and collision tests:
  - `tests/reliability/subagents-catalog.test.ts`
- Added runtime alias selection coverage:
  - `tests/reliability/subagents-backend.test.ts`
- Added CLI keyword parsing coverage for alias tags:
  - `tests/reliability/team-run-subagents-options.test.ts`
- Added integration coverage for alias-tagged `team run`:
  - `tests/integration/subagents-team-run.test.ts`

### Docs

- Documented alias resolution and collision behavior:
  - `docs/architecture/runtime-backend.md`
  - `docs/setup/quickstart.md`
  - `docs/omg/commands.md`

## Adversarial cross-review

1. **Collision case**
   - Verified catalog alias collisions fail fast instead of silently routing to
     the wrong role.
   - Evidence: `tests/reliability/subagents-catalog.test.ts`

2. **Duplicate canonical selection**
   - Verified `review,code-reviewer` resolves to one canonical role instead of
     producing duplicate assignments.
   - Evidence: `tests/reliability/subagents-backend.test.ts`

3. **Skill-token regression**
   - Preserved role-skill fallback routing by avoiding false alias collisions
     across shared skill names like `plan`/`team`.
   - Evidence: `tests/reliability/subagents-catalog-role-skill.test.ts`

4. **End-to-end operator path**
   - Verified `$plan /execute` completes a real `omg team run` with canonical
     runtime output (`planner`, `executor`).
   - Evidence: `.omg/state/team/worker6-alias-e2e/monitor-snapshot.json`

## Verification commands

```bash
npm run typecheck
npm run lint
npm run test:reliability
npm run test:integration
npm run test
OMG_EXPERIMENTAL_ENABLE_AGENTS=true npm run omg -- team run --task '$plan /execute alias-e2e-smoke' --team worker6-alias-e2e --max-fix-loop 0 --json
```
