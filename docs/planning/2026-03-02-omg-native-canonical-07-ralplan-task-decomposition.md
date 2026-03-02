# OmG-Native Canonical 07 — Ralplan-Ready Task Decomposition

Status: **Canonical (authoritative)**  
Date: 2026-03-02

## 1) Execution lanes

- Lane A: control-plane core
- Lane B: lifecycle CLI
- Lane C: worker protocol hardening
- Lane D: role/skill contract
- Lane E: gates + rollout readiness

## 2) Canonical dependency-ordered tasks

| ID | Subject | Depends on | Verification |
|---|---|---|---|
| CP-01 | Freeze control-plane and transition contracts | - | doc review + signoff |
| CP-02 | Implement claim API + lease semantics | CP-01 | reliability conflict tests |
| CP-03 | Implement transition API with claim-token guard | CP-02 | invalid-transition negative tests |
| CP-04 | Implement release claim API | CP-02 | release-path reliability tests |
| CP-05 | Add mailbox lifecycle helper semantics | CP-01 | mailbox reliability tests |
| CLI-01 | Add `team status` command | CP-02 | integration command tests |
| CLI-02 | Add `team resume` command | CP-03 | integration resume tests |
| CLI-03 | Add `team shutdown` command | CP-03 | integration shutdown tests |
| CLI-04 | Align docs/help/extension prompts for lifecycle commands | CLI-01,CLI-02,CLI-03 | docs contract check |
| WP-01 | Standardize worker protocol template | CP-01 | protocol fixture tests |
| WP-02 | Enforce ACK/claim/evidence/idle in tmux runtime | CP-03,WP-01 | protocol reliability tests |
| WP-03 | Add failure reason taxonomy for protocol/control-plane paths | WP-02 | snapshot assertions |
| RS-01 | Define role artifact schema v1 (`planner`,`executor`,`verifier`) | CP-01 | schema tests |
| RS-02 | Persist deterministic artifact paths/index | RS-01 | integration artifact assertions |
| RS-03 | Role->skill mapping registry (`plan`,`team`,`review`,`verify`,`handoff`) | RS-01 | mapping validation checks |
| RS-04 | Enforce verify-stage failure on missing/invalid role artifacts | RS-02,RS-03 | role evidence reliability tests |
| GT-01 | Activate C3 gate (control-plane integrity) | CP-04,CP-05 | CI dry-run |
| GT-02 | Activate C4/C5 gates (lifecycle + protocol) | CLI-04,WP-03 | CI dry-run |
| GT-03 | Activate C6 gate (role/skill evidence) | RS-04 | CI dry-run |
| GT-04 | Activate C7 gate (docs/deprecation/legacy policy) | GT-01,GT-02,GT-03 | release-gate rehearsal |
| RL-01 | Ring 0/1 rollout rehearsal | GT-02 | runbook evidence |
| RL-02 | Ring 2 default-lifecycle promotion | GT-03,RL-01 | cycle evidence |
| RL-03 | Ring 3 strict GA promotion | GT-04,RL-02 | two-cycle evidence |

## 3) Task result contract (required)

Every task completion must include:

```text
Verification:
- PASS|FAIL: <command> (exit=<code>)

Artifacts:
- files: <path list>
- compatibility impact: <none|details>
```

## 4) Immediate seed for `/ralplan`

Start with:

1. CP-01
2. CP-02
3. CLI-01
4. WP-01
5. RS-01

This maximizes parallelism while keeping dependency safety.
