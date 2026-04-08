---
name: autopilot
aliases: ["/autopilot", "full auto", "autonomous execution", "build it"]
primaryRole: orchestrator
description: Autonomously drive a feature from clarified objective through implementation and verification.
---

# Autopilot Skill (oh-my-product)

Use this skill when the user wants end-to-end execution with minimal supervision.

## Use when
- The request is large enough to require planning, implementation, and verification
- The user wants the agent to make reasonable assumptions and keep moving
- A phased workflow is safer than ad hoc editing

## Workflow
1. Clarify the objective, constraints, and acceptance criteria.
2. Produce or refine a phased plan.
3. Execute the plan with minimal coherent changes.
4. Validate with typecheck, tests, and `omp verify` when relevant.
5. Return a completion summary, evidence, and follow-ups.

## Stop conditions
- Missing requirements materially change the solution
- Validation repeatedly fails without a credible next fix
- The user asks to stop or switch to manual control

## Related surfaces
- `omp skill plan`
- `omp skill execute`
- `omp skill verify`
- `omp team run`
