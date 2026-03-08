---
name: cancel
aliases: ["/cancel", "stop work", "abort", "halt"]
primaryRole: coordinator
description: Safely stop active work, note what was interrupted, and preserve resumable context.
---

# Cancel Skill (oh-my-gemini)

Use this skill when the user wants to stop an active workflow or leave a safe checkpoint.

## What it does
- prefers graceful shutdown over abrupt interruption
- summarizes what completed, what is in progress, and what remains reusable
- points to concrete stop commands when available

## Primary commands
- `omg team cancel --team <name>`
- `omg team shutdown --team <name>`
- `omg skill handoff`
- `omg skill status`

## Output
Return:
- current objective
- what was cancelled
- persisted state or artifact locations
- recommended next step for resuming later
