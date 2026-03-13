---
name: ralplan
aliases: ["/ralplan", "consensus plan", "consensus planning"]
primaryRole: orchestrator
description: Iterative planning with structured consensus — planner, architect, and critic converge on an approved plan.
---

# Ralplan Skill (oh-my-gemini)

Consensus-based planning that iterates until planner, architect, and critic agree.

## Use when
- The task is complex enough that a single planning pass is insufficient
- Architecture decisions need structured debate before execution
- High-risk work requires pre-mortem analysis

## Workflow

### Standard (default)
1. **Planner** drafts execution plan with task decomposition
2. **Architect** reviews for technical soundness and boundary issues
3. **Critic** challenges for completeness, risks, and missing edge cases
4. **Iterate** until all three agents converge (max 3 rounds)
5. Output: approved plan synced to `/omg:taskboard`

### Deliberate (--deliberate flag, for high-risk work)
Adds to standard workflow:
1. **Pre-mortem**: "Assume this plan failed — what went wrong?"
2. **Test strategy**: Unit, integration, e2e, and observability planning
3. **Rollback plan**: How to undo if things go wrong
4. Extra iteration round allowed (max 4 total)

## Convergence criteria
- All three agents approve the plan
- No unresolved HIGH severity concerns
- Acceptance criteria are testable
- Dependencies are acyclic

## Output format
```
## Plan: [Title]
### Phases
Phase 1: [tasks, owners, dependencies]
Phase 2: ...

### Consensus
- Planner: APPROVE
- Architect: APPROVE (with note: ...)
- Critic: APPROVE

### Risk Register
| Risk | Impact | Mitigation |
```

## Related commands
- `/omg:consensus` — general decision convergence
- `/omg:team/plan` — team-scoped planning
- `/omg:taskboard sync` — sync plan to task ledger
