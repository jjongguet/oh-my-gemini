# C4 — Worker Protocol + Role/Skill Contract

## 1) Worker protocol (normative)

1. Resolve team context and state root
2. Read inbox and assigned task
3. Send ACK to `leader-fixed`
4. Claim task via control-plane API
5. Execute assigned work
6. Write structured result/evidence
7. Transition/mark completion
8. Set worker status `idle` (or `blocked`/`failed` with reason)
9. Poll mailbox for next instruction

## 2) Required worker state semantics

- `idle`: no active claim/work
- `in_progress`: active claimed task
- `blocked`: external dependency/shared-file lock/ambiguity
- `failed`: execution failed with error evidence

Every non-idle state MUST include a reason field.

## 3) Minimum role contract

| Role | Required responsibilities | Required artifacts |
|---|---|---|
| planner | decomposes work, sequencing/dependency clarity | plan + dependency graph |
| executor | implements scoped changes | diff summary + command evidence |
| verifier | validates completion and regression status | PASS/FAIL matrix + outputs |

Optional specialist roles may be added only if they do not weaken minimum role outputs.

## 4) Skill contract (minimum)

Each production skill path MUST define:
- input intent,
- execution steps,
- success criteria,
- required evidence output format.

Minimum skill band for parity baseline:
- execute
- review
- verify
- handoff

## 5) Evidence schema (required)

```json
{
  "task_id": "string",
  "worker": "string",
  "status": "completed|failed|blocked",
  "summary": "string",
  "verification": [
    {
      "name": "typecheck|test|lint|e2e|regression",
      "result": "PASS|FAIL",
      "command": "string",
      "output_ref": "string"
    }
  ]
}
```

## 6) Parity requirements for OmG adoption

- PR-C4-01: Worker ACK is mandatory before work start in team-run paths.
- PR-C4-02: Claim-before-work is mandatory for mutable/owned tasks.
- PR-C4-03: Completion requires structured verification evidence.
- PR-C4-04: Mailbox semantics must support notified/delivered tracking.
- PR-C4-05: Extension prompt surface must align with runtime contract vocabulary.

## 7) Failure handling contract

If blocked:
- set worker state to `blocked` with precise reason,
- do not modify shared files without explicit coordination,
- notify lead via mailbox.

If failed:
- include attempted fix steps,
- include failing command outputs,
- include recommended next action.

