---
name: deep-interview
aliases: ["/deep-interview", "deep interview", "interview", "requirements interview"]
primaryRole: analyst
description: Run a structured Socratic interview before planning or execution.
---

<Purpose>
Deep Interview clarifies goals, constraints, and success criteria before implementation.
Use it when ambiguity is high and premature coding would create rework.
</Purpose>

<Use_When>
- The request is broad, vague, or underspecified
- Multiple interpretations are possible
- Tradeoffs (time, quality, risk, scope) are unclear
- The user asks for an interview, discovery, or requirements clarification
</Use_When>

<Do_Not_Use_When>
- The task is a small focused fix with clear acceptance criteria
- The user explicitly asks to skip discovery and proceed immediately
</Do_Not_Use_When>

<Execution_Policy>
- Ask one question at a time
- Prefer concrete, decision-driving questions
- Converge quickly: stop when requirements are actionable
- Finish with an explicit contract summary and open risks
</Execution_Policy>

<Steps>
1. Restate the objective and constraints from the prompt.
2. Ask targeted questions in this order:
   - Outcome and non-goals
   - Scope boundaries
   - Operational constraints (time, infra, compliance)
   - Acceptance criteria and evidence
3. After each answer, refine assumptions and ask the next highest-impact question.
4. Stop when you can produce a clear implementation-ready brief.
5. Output a final summary with:
   - Objective
   - In-scope / out-of-scope
   - Acceptance criteria
   - Risks / unknowns
   - Recommended next step (`plan`, `team`, or direct execution)
</Steps>

<Output_Format>
## Interview Summary

### Objective
- ...

### Scope
- In: ...
- Out: ...

### Acceptance Criteria
- [ ] ...

### Open Risks / Unknowns
- ...

### Recommended Next Action
- Use `omp skill plan` (or another named next step) with the summary above.
</Output_Format>

Task: {{ARGUMENTS}}
