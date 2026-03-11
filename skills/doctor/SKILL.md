---
name: doctor
aliases: ["/doctor", "health check", "diagnose install", "fix setup"]
primaryRole: diagnostician
description: Inspect setup, extension assets, runtime prerequisites, and state health.
---

# Doctor Skill (oh-my-gemini)

Use this skill when the user needs environment or installation diagnostics.

## Primary command
- `omg doctor`

## Typical checks
- Node, npm, Gemini CLI, tmux, and container runtime availability
- extension manifest, commands, and skills
- persisted state writeability and team state integrity

## Follow-up
If the issue is environmental, recommend `omg setup` or the smallest safe corrective action.
