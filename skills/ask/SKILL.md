---
name: ask
aliases: ["/ask", "advisor", "ask gemini", "run advisor prompt"]
primaryRole: advisor
description: Run a focused Gemini advisor prompt and save the result as a reusable artifact.
---

# Ask Skill (oh-my-product)

Use this skill when the user wants a quick advisor-style answer from Gemini without launching a full workflow.

## Preferred route
- `omp ask gemini --prompt "<prompt>"`
- `omp ask gemini --agent-prompt <role> --prompt "<prompt>"`

## Artifact location
Results should be stored under:
- `.omp/artifacts/ask/`

## Good use cases
- second opinion on a design
- implementation suggestions before coding
- role-shaped advice for planner, reviewer, or debugger prompts
