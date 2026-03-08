---
name: wait
aliases: ["/wait", "rate limit wait", "resume later", "wait for quota"]
primaryRole: operator
description: Check rate-limit state and manage auto-resume behavior for blocked Gemini work.
---

# Wait Skill (oh-my-gemini)

Use this skill when Gemini is rate limited or the user wants auto-resume behavior.

## Primary commands
- `omg wait`
- `omg wait --start`
- `omg wait --stop`

## Expected output
- current rate-limit status
- whether auto-resume is active
- the next recommended action
