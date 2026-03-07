---
name: handoff
aliases: ["/handoff", "handover", "hand off", "transfer context"]
primaryRole: coordinator
description: Produce a concise handoff package for the next agent or session.
---

<Purpose>
Handoff captures current state and next actions so work can continue without rediscovery.
</Purpose>

<Execution_Policy>
- Include only high-signal context
- Separate completed work from pending work
- Preserve exact commands, files, and blockers
- End with a deterministic next step list
</Execution_Policy>

<Output_Format>
# Handoff: <task>

## Completed
- ...

## Current State
- Branch: ...
- Status: ...
- Key artifacts: ...

## Pending
- [ ] <task>

## Blockers / Risks
- ...

## Next Actions
1. ...
2. ...

## Runbook
- Validate: `npm run typecheck`
- Tests: `npm run test`
- Verify: `npm run verify`
</Output_Format>

Task: {{ARGUMENTS}}
