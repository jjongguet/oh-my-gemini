---
name: review
aliases: ["/review", "code review", "review code", "review pr"]
primaryRole: reviewer
description: Perform a structured evidence-based code review with severity ratings.
---

<Purpose>
Review evaluates correctness, security, maintainability, and test confidence before merge.
</Purpose>

<Use_When>
- User asks for PR review, code audit, or change assessment
- You need release-readiness confidence and concrete findings
</Use_When>

<Execution_Policy>
- Prioritize defects over style opinions
- Every finding must include evidence (file and behavior impact)
- Rank findings by severity: critical/high/medium/low
- Include missing tests and verification gaps
</Execution_Policy>

<Checklist>
1. Correctness: edge cases, state transitions, null/undefined handling
2. Security: injection vectors, authz/authn gaps, secret handling
3. Reliability: retries/timeouts, error propagation, race conditions
4. Maintainability: coupling, duplication, naming clarity, complexity
5. Test Adequacy: missing coverage, flaky risk, weak assertions
</Checklist>

<Output_Format>
## Review Summary

### Critical
- [ ] <issue + evidence>

### High
- [ ] <issue + evidence>

### Medium
- [ ] <issue + evidence>

### Low / Suggestions
- [ ] <suggestion>

### Verification Gaps
- [ ] <missing test or validation>
</Output_Format>

Task: {{ARGUMENTS}}
