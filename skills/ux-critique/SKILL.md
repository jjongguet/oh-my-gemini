---
name: ux-critique
aliases: ["/ux-review", "ux critique", "usability review", "accessibility audit", "a11y check"]
primaryRole: designer
description: Activate when the user requests a UX review, usability critique, or accessibility audit of a page, component, or user flow. Evaluates against Nielsen's heuristics and WCAG guidelines.
---

# UX Critique Skill (oh-my-product)

Use this skill to evaluate UI/UX quality, usability, and accessibility.

## Evaluation Frameworks

### Nielsen's 10 Usability Heuristics
1. Visibility of system status
2. Match between system and real world
3. User control and freedom
4. Consistency and standards
5. Error prevention
6. Recognition rather than recall
7. Flexibility and efficiency of use
8. Aesthetic and minimalist design
9. Help users recognize, diagnose, and recover from errors
10. Help and documentation

### WCAG 2.1 Accessibility Checklist
- **Perceivable**: Text alternatives, captions, contrast (4.5:1), resize-friendly
- **Operable**: Keyboard accessible, no seizure triggers, navigable, input modalities
- **Understandable**: Readable, predictable, input assistance
- **Robust**: Compatible with assistive technologies

## Workflow

1. **Scope** — What is being reviewed (page, flow, component, full site)
2. **Inspect** — Read the source code / rendered output
3. **Evaluate** — Apply heuristics + WCAG checklist
4. **Score** — Rate each dimension (pass / warning / fail)
5. **Recommend** — Prioritized fixes with code examples

## Output Format

```markdown
## UX Critique Report

### Summary
- Overall score: X/10
- Critical issues: N
- Warnings: N

### Heuristic Evaluation
| # | Heuristic | Score | Finding |
|---|-----------|-------|---------|
| 1 | Visibility of system status | pass/warn/fail | Detail... |
...

### Accessibility Audit
| Level | Criterion | Status | Detail |
|-------|-----------|--------|--------|
| A | 1.1.1 Non-text Content | pass/fail | ... |
...

### Prioritized Recommendations
1. [CRITICAL] ...
2. [WARNING] ...
3. [IMPROVEMENT] ...
```

## Rules

- Always check DESIGN.md first if it exists — evaluate consistency with defined tokens
- Test responsive behavior at 375px, 768px, 1280px viewports
- Check both light and dark mode if applicable
- Include concrete code fix suggestions, not just descriptions
- Flag any hardcoded values that should reference DESIGN.md tokens
