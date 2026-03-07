---
name: verify
aliases: ["/verify", "verify work", "check completion", "validate"]
primaryRole: verifier
description: Validate completion evidence against acceptance criteria and report pass/fail.
---

<Purpose>
Verify confirms that changes satisfy acceptance criteria with reproducible evidence.
</Purpose>

<Execution_Policy>
- Treat claims as unverified until evidence exists
- Prefer deterministic checks and explicit command outputs
- Report both pass status and concrete gaps
</Execution_Policy>

<Steps>
1. Build/typecheck baseline
2. Run relevant tests (targeted + broader smoke)
3. Inspect required runtime/state artifacts
4. Map each acceptance criterion to evidence
5. Return PASS/FAIL with remediation steps
</Steps>

<Output_Format>
## Verification Report

### Build/Typecheck
- PASS | FAIL

### Tests
- PASS | FAIL
- Evidence: <command + key output>

### Acceptance Criteria
- [x] <criterion> — evidence: <file/output>
- [ ] <criterion> — missing: <what failed>

### Overall
- PASS | FAIL

### Next Actions
1. ...
2. ...
</Output_Format>

Task: {{ARGUMENTS}}
