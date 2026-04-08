---
name: prd
aliases: ["/prd", "product requirements", "acceptance criteria"]
primaryRole: analyst
description: Transform a request into a measurable PRD with acceptance criteria, non-goals, and constraints.
---

# PRD Skill (oh-my-product)

Convert vague objectives into precise, locked product requirements.

## Use when
- Starting a new feature or significant change
- The team needs clear "done" criteria before execution
- Scope creep is a risk and boundaries must be explicit

## Workflow
1. **Capture objective**: What are we building and why?
2. **Define acceptance criteria**: Testable conditions for "done"
3. **List non-goals**: What is explicitly out of scope
4. **Identify constraints**: Technical, timeline, resource limits
5. **Specify verification**: How we prove each criterion is met
6. **Lock**: PRD becomes immutable until explicitly unlocked

## PRD Template

```markdown
## Objective
[1-2 sentences]

## Acceptance Criteria
- [ ] [Testable condition with measurable outcome]
- [ ] [Testable condition with measurable outcome]

## Non-Goals
- [Related thing that is NOT part of this work]

## Constraints
- [Technical/timeline/resource limitation]

## Risk Factors
- [What could block or derail this work]

## Verification Method
- [How each acceptance criterion will be verified]
```

## Rules
- Every acceptance criterion must be independently testable
- Non-goals are mandatory — minimum 2 items
- Constraints must reference concrete limits (not "be fast")
- Once locked, changes require explicit unlock + re-approval
- PRD persisted to `.omp/state/prd.md`

## Related commands
- `/omp:team/prd` — team-scoped PRD creation
- `/omp:taskboard sync` — generate tasks from PRD criteria
