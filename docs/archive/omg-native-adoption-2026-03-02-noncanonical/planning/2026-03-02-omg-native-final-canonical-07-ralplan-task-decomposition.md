# OmG-native Final Canonical Set (07/07): ralplan-ready Task Decomposition

Date: 2026-03-02  
Status: **Execution backlog**
Depends on: FC2, FC3, FC4, FC5, FC6

## 1) Recommended role mix

Required baseline roles:
- planner
- architect
- executor
- test-engineer
- verifier
- writer

Optional later roles:
- security-reviewer
- qa-tester

---

## 2) Execution rules

1. No lifecycle-field mutation outside control-plane APIs once Phase 1 begins.
2. Every code task must attach verification evidence.
3. Shared-file edits require dependency ordering and ownership clarity.
4. Do not flip new defaults until matching gate IDs are green.

---

## 3) Canonical task backlog

| ID | Subject | Owner | Deps | Code | Done when |
|---|---|---|---|---|---|
| T01 | Freeze control-plane API spec | architect | - | No | claim/transition/release contracts approved |
| T02 | Define lifecycle reason-code taxonomy | architect | T01 | No | error codes and meanings documented |
| T03 | Implement claim API | executor | T01 | Yes | token + lease claim path exists and is tested |
| T04 | Implement transition API | executor | T01,T03 | Yes | guarded transitions exist and reject invalid edges |
| T05 | Implement release API | executor | T01,T03 | Yes | stale/owner mismatch behavior is deterministic |
| T06 | Add dependency readiness checks | executor | T03 | Yes | blocked claims surface dependency IDs |
| T07 | Update persisted task/state schema docs | writer | T03,T04,T05,T06 | No | state docs reflect new lifecycle contract |
| T08 | Add `omg team status` | executor | T01 | Yes | status command returns phase/tasks/workers/health |
| T09 | Add `omg team shutdown` | executor | T08 | Yes | graceful + force behaviors are tested |
| T10 | Add `omg team resume` | executor | T08 | Yes | resume rehydrates or fails with actionable error |
| T11 | Align CLI help/docs/extensions for lifecycle commands | writer | T08,T09,T10 | No | help/docs/prompts agree |
| T12 | Standardize worker bootstrap template/protocol | executor | T01,T02 | Yes | single protocol source exists |
| T13 | Enforce ACK + identity resolution in tmux path | executor | T12 | Yes | live worker startup emits ACK and identity evidence |
| T14 | Enforce claim-before-work | executor | T03,T12,T13 | Yes | worker cannot execute without valid claim |
| T15 | Enforce structured completion evidence | executor | T04,T13,T14 | Yes | result payload carries verification evidence |
| T16 | Add worker protocol tests | test-engineer | T13,T14,T15 | Yes | protocol failures are asserted |
| T17 | Define role->skill->artifact schema v1 | architect | T01 | No | planner/executor/verifier contract published |
| T18 | Implement `execute` skill | executor | T17 | Yes | extension skill exists and emits expected outputs |
| T19 | Implement `review` skill | executor | T17,T18 | Yes | review skill emits schema-valid artifacts |
| T20 | Implement `verify` skill | executor | T17,T18 | Yes | verify skill captures command evidence |
| T21 | Implement `handoff` skill | executor | T17,T18,T20 | Yes | handoff artifact is deterministic |
| T22 | Add role-contract tests | test-engineer | T17,T18,T19,T20,T21 | Yes | invalid routing/artifact cases fail deterministically |
| T23 | Add control-plane reliability suite | test-engineer | T03,T04,T05,T06 | Yes | G1 evidence exists |
| T24 | Add lifecycle CLI integration suite | test-engineer | T08,T09,T10 | Yes | G2 evidence exists |
| T25 | Add live team e2e protocol coverage | qa-tester | T13,T14,T15 | Yes | G3 evidence exists |
| T26 | Wire adoption gates into CI/release | executor | T23,T24,T22 | Yes | G1..G5 staged into workflows |
| T27 | Add legacy bypass detection to release path | executor | T26 | Yes | release baseline fails when bypass flags are required |
| T28 | Run full regression and record go/no-go | verifier | T11,T16,T22,T26,T27 | No | all gates green or escalation note recorded |

---

## 4) Milestones

| Milestone | Tasks |
|---|---|
| M1 Control-plane | T01–T07 |
| M2 Lifecycle CLI | T08–T11 |
| M3 Worker protocol | T12–T16 |
| M4 Role/skill contract | T17–T22 |
| M5 Gates + release readiness | T23–T28 |

---

## 5) Suggested seed order for `/ralplan`

1. T01 (architect)
2. T03 (executor, blocked only by T01)
3. T08 (executor, blocked only by T01)
4. T17 (architect)
5. T23 (test-engineer, blocked by T03–T06)
6. T11 (writer, blocked by T08–T10)

