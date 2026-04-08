---
name: handoff
aliases: ["/handoff", "hand off", "transfer context", "pass context"]
primaryRole: coordinator
description: Produce a structured handoff document summarizing completed work and next steps.
---

# Handoff Skill (oh-my-product)

Use this skill when transitioning work between sessions, agents, or team members.

## What it does

Produces a structured handoff document that captures:
- What was accomplished
- Current state of the system
- Pending tasks and blockers
- Next recommended actions
- Key files and state locations

## Handoff document format

```markdown
# Handoff: <project/task name>

## Completed Work
- <item 1>
- <item 2>

## Current State
- Phase: <phase>
- Status: <status>
- Key artifacts: <files>

## Pending / In Progress
- [ ] <task with owner if known>

## Blockers
- <blocker if any>

## Next Recommended Actions
1. <action 1>
2. <action 2>

## Key Locations
- State: `.omp/state/`
- Context: `.gemini/GEMINI.md`
- Plan: `.omp/plans/`
```

## Usage

```
omp skill handoff [--task "<task name>"]
```
