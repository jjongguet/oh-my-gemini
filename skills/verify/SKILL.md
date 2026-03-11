---
name: verify
aliases: ["/verify", "verify work", "check completion", "validate"]
primaryRole: verifier
description: Verify that acceptance criteria are met and work is complete.
---

# Verify Skill (oh-my-gemini)

Use this skill when the user wants to verify that a task or feature is complete.

## What it does

Checks evidence of completion against acceptance criteria. Runs smoke tests, inspects state files, and reports any gaps between expected and actual outcomes.

## Verification steps

1. **Build** — Confirm the project builds without errors (`npm run build`)
2. **Tests** — Run the test suite (`npm run test:smoke`)
3. **State** — Check for required state artifacts (done signals, phase state)
4. **Criteria** — Map each acceptance criterion to concrete evidence
5. **Report** — Output pass/fail with actionable gaps

## Output format

```
## Verification Report

### Build: PASS / FAIL
### Tests: PASS / FAIL (N/M passed)
### Acceptance Criteria:
- [x] Criterion 1 — evidence: <file or output>
- [ ] Criterion 2 — MISSING: <what is expected>

### Overall: PASS / FAIL
```

## Usage

```
omg skill verify [--criteria "<list of criteria>"]
```
