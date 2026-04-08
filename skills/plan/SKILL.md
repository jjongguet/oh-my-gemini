---
name: plan
aliases: ["/plan", "plan this", "make a plan", "execution plan"]
primaryRole: planner
description: Produce a phased execution plan aligned to the oh-my-product roadmap gates.
---

# Plan Skill (oh-my-product)

Use this skill when a user asks for planning, decomposition, or implementation sequencing.

## Planning template

1. **Clarify objective**
   - Desired outcome
   - Constraints (time, environment, sandbox, scope)

2. **Map to roadmap phase**
   - Phase 0: bootstrap + sandbox baseline
   - Phase 1A: setup/doctor/verify harness
   - Phase 1B: minimal orchestration lifecycle
   - Phase 2+: reliability hardening and expansion

3. **Define acceptance gates**
   - Gate 0 (decision lock)
   - Gate 1A (install + doctor + verify)
   - Gate 1B (team lifecycle)

4. **Execution sequencing**
   - Order tasks by dependency
   - Explicitly mark parallelizable work
   - Include rollback/failure handling points

5. **Verification checklist**
   - Commands to run
   - Required artifacts (logs/state files)
   - Exit criteria for “done”

## Output format

Return a concise plan with:
- milestones,
- owners (if applicable),
- risks + mitigations,
- exact commands for verification.
