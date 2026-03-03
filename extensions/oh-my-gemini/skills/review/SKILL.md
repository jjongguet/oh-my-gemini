---
name: review
aliases: ["/review", "code review", "review code", "review pr"]
primaryRole: reviewer
description: Perform a structured code review of recent changes or a specific scope.
---

# Review Skill (oh-my-gemini)

Use this skill when the user wants to perform a code review.

## What it does

Executes a structured code review covering correctness, security, maintainability, and test coverage. Outputs findings with severity ratings (critical / high / medium / low).

## Review checklist

1. **Correctness** — Logic errors, edge cases, null/undefined handling
2. **Security** — Injection, auth bypass, secret exposure, OWASP Top 10
3. **Maintainability** — Code clarity, naming, duplication, coupling
4. **Test coverage** — Missing tests, untested paths, flaky patterns
5. **Performance** — O(n²) loops, N+1 queries, memory leaks

## Output format

```
## Review Summary

### Critical
- [ ] <issue with file:line reference>

### High
- [ ] <issue with file:line reference>

### Medium
- [ ] <issue with file:line reference>

### Low / Suggestions
- [ ] <suggestion>
```

## Usage

Run via skill dispatch:
```
omg skill review [--scope <files or description>]
```
