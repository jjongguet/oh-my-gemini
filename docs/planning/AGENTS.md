<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# planning

## Purpose
Active canonical planning documents for phased execution, acceptance gates, rollout/rollback, and task decomposition.

## Key Files

| File | Description |
|------|-------------|
| `2026-03-02-omg-native-canonical-04-phased-execution-plan.md` | Canonical phased execution plan. |
| `2026-03-02-omg-native-canonical-05-acceptance-and-ci-gates.md` | Canonical acceptance and CI gates. |
| `2026-03-02-omg-native-canonical-06-risk-rollout-and-rollback.md` | Canonical risk, rollout, and rollback guidance. |
| `2026-03-02-omg-native-canonical-07-ralplan-task-decomposition.md` | Canonical task decomposition and ralplan guidance. |
| `2026-03-02-team-orchestration-role-skill-master-todo.md` | Orchestration role/skill TODO and execution backlog. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep only current planning guidance here; move superseded alternatives into `docs/archive/`.
- Tie plans to real commands, real verification gates, and the current implementation surface.

### Testing Requirements
- Verify referenced commands, gates, and artifact paths exist before editing canonical plans.

### Common Patterns
- Date-prefixed planning docs organized by phase or gate.
- Phased execution, gate criteria, rollout, and decomposition documents feed implementation work.

## Dependencies

### Internal
- Builds on `docs/analysis/`, `docs/testing/`, `scripts/`, `tests/`, and implementation under `src/`.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
