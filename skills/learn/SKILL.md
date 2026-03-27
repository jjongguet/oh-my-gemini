---
name: learn
aliases: ["/learn", "extract learning", "create skill from this", "learn from this"]
primaryRole: documenter
description: "Extract a reusable lesson, checklist, or future skill idea from completed work. Use when the user says 'lessons learned', 'what worked', 'document takeaways', 'create checklist from this', or wants to capture insights from a debugging session, project milestone, or completed task for future reference."
---

# Learn Skill (oh-my-gemini)

Use this skill when a session produced a reusable workflow, rule, or troubleshooting pattern worth preserving.

## Workflow

1. **Identify the pattern** — review what happened in the session and isolate the repeatable insight.
2. **Extract trigger conditions** — define when this lesson applies (e.g., "whenever a CI deploy fails on staging").
3. **Write the checklist** — distill the solution into the shortest actionable steps.
4. **Choose a destination** — place the output where it will be found next time.

## Output template

```markdown
## Problem
[What kept happening or what was discovered]

## Lesson
[The durable insight — one or two sentences]

## Trigger
[When to apply this — specific conditions or signals]

## Checklist
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
```

## Example

**Input**: A session where `omg team run` workers failed because Docker wasn't running.

**Output**:
```markdown
## Problem
Team orchestration workers exit immediately when Docker daemon is not running.

## Lesson
Always run `omg doctor` before `omg team run` to catch missing prerequisites.

## Trigger
Before any team orchestration session, or when workers fail on launch.

## Checklist
- [ ] Run `omg doctor` and confirm all checks pass
- [ ] Start Docker if the daemon check fails
- [ ] Re-run `omg team run` after fixes
```

## Suggested destinations

- Project docs (`docs/`)
- Handoff notes (via `/omg:handoff`)
- Future skill or prompt surfaces (`src/skills/`, `src/prompts/`)

Task: {{ARGUMENTS}}
