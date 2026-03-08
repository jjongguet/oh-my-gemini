---
name: cancel
aliases: ["/cancel", "stop work", "abort"]
primaryRole: coordinator
description: Stop or wind down active work safely and summarize the resulting state.
---

# Cancel

Use this skill when the user wants to stop a run, abort work, or preserve a safe stopping point.

## Policy
- Prefer safe shutdown over abrupt termination when state may be persisted.
- Record what was cancelled and what remains reusable.
- Leave the system in a recoverable state when possible.
