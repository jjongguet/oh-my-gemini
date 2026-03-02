# ralplan-ready Task Decomposition — OmG-native Orchestration + Role/Skill Adoption

Date: 2026-03-02  
Depends on:
- `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md`
- `docs/planning/2026-03-02-omg-native-adoption-phased-execution-plan.md`

This backlog is structured for direct team execution (`/ralplan` or equivalent team tasking).

---

## 1) Suggested Team Role Mix

Minimum recommended parallel role set:

- planner
- architect
- executor
- test-engineer
- verifier
- writer

Optional:

- security-reviewer
- qa-tester

---

## 2) Execution Rules

1. No lifecycle field mutation without claim-token path once control-plane APIs land.
2. Every code task must include fresh verification output.
3. Shared-file edits require explicit dependency ordering.
4. Do not enable new defaults until corresponding gate tasks are complete.

---

## 3) Task List (ordered, dependency-aware)

Legend:

- `Deps`: task IDs that must be completed first
- `Code`: whether task requires implementation changes

| ID | Subject | Owner role | Deps | Code | Definition of Done | Required verification |
|---|---|---|---|---|---|---|
| T01 | Design OmG control-plane API spec (claim/transition/release) | architect | - | No | Spec doc merged; method contracts, error taxonomy, invariants defined | doc review by planner + verifier |
| T02 | Implement claim lock utility with stale-lock handling | executor | T01 | Yes | lock helper added and unit-tested | `npm run test:reliability` |
| T03 | Add `claimTask` API to OmG state/team layer | executor | T01,T02 | Yes | claim returns token + lease metadata, blocks invalid claims | reliability tests for claim conflict/blocking |
| T04 | Add `transitionTaskStatus` API with claim-token enforcement | executor | T03 | Yes | legal transitions only; terminal semantics enforced | reliability tests for invalid transitions |
| T05 | Add `releaseTaskClaim` API | executor | T03 | Yes | claim release resets task to pending safely | reliability tests for release conflict/expiry |
| T06 | Add dependency-readiness computation for claims | executor | T03 | Yes | blocked dependencies surfaced with deterministic errors | reliability tests for blocked dependency path |
| T07 | Document updated state schema and lifecycle semantics | writer | T03,T04,T05,T06 | No | docs updated with lifecycle contract examples | markdown contract review |
| T08 | Add CLI: `omg team status` | executor | T01 | Yes | status command prints/returns phase+tasks+workers | `npm run test:integration` |
| T09 | Add CLI: `omg team shutdown` | executor | T08 | Yes | graceful/force behavior documented + tested | integration test run->shutdown |
| T10 | Add CLI: `omg team resume` | executor | T08 | Yes | resumable runs rehydrate state correctly | integration resume scenario |
| T11 | Update CLI help/docs for lifecycle commands | writer | T08,T09,T10 | No | README + command docs aligned | docs diff review |
| T12 | Implement standardized worker protocol template generator | executor | T01 | Yes | single-source worker protocol generation exists | reliability tests for protocol fields |
| T13 | Wire tmux dispatch to generated worker protocol + claim-first flow | executor | T12,T03 | Yes | worker starts with ACK/inbox/claim semantics | live e2e smoke evidence |
| T14 | Enforce completion evidence write format in worker flow | executor | T13,T04 | Yes | worker completion includes structured evidence payload | reliability test for missing evidence rejection |
| T15 | Add monitor reason taxonomy for lifecycle/control-plane failures | executor | T04,T13 | Yes | reason codes standardized and exposed | reliability suite + snapshot assertions |
| T16 | Expand extension skills: `execute` | executor | T01 | Yes | skill exists and maps to role contract | skill invocation smoke |
| T17 | Expand extension skills: `review` | executor | T16 | Yes | review skill outputs schema-compliant evidence | skill invocation smoke |
| T18 | Expand extension skills: `verify` | executor | T17 | Yes | verify skill enforces command evidence collection | `npm run verify -- --json` |
| T19 | Expand extension skills: `handoff` | executor | T18 | Yes | handoff skill emits rollout-ready summary artifact | skill invocation smoke |
| T20 | Publish role->skill->artifact contract doc | writer | T16,T17,T18,T19 | No | canonical mapping doc added | planner/verifier sign-off |
| T21 | Add team control-plane reliability test suite | test-engineer | T03,T04,T05,T06 | Yes | deterministic tests for claim/transition/release lifecycle | `npm run test:reliability` |
| T22 | Add integration tests for lifecycle commands (`status/resume/shutdown`) | test-engineer | T08,T09,T10 | Yes | integration suite covers operator flows | `npm run test:integration` |
| T23 | Add CI gate script `gate:team-control-plane` and wire into blocking flow | executor | T21,T22 | Yes | gate runs in CI before publish path | CI dry run + local execution |
| T24 | Add legacy bypass detection in release gating | executor | T23 | Yes | publish gate fails if legacy bypass env toggles are set | gate script output evidence |
| T25 | Run full regression + publish-readiness verification | verifier | T11,T15,T20,T23,T24 | No | all suites pass, evidence attached, go/no-go decision recorded | `npm run typecheck && npm run test && npm run verify && npm run gate:publish` |

---

## 4) Milestone Packaging

## Milestone M1 (Control plane)

- T01-T07

## Milestone M2 (Lifecycle CLI)

- T08-T11

## Milestone M3 (Worker/runtime hardening)

- T12-T15

## Milestone M4 (Role/skill expansion)

- T16-T20

## Milestone M5 (Gate + release readiness)

- T21-T25

---

## 5) Ready-to-run Task Seed (example)

If seeding tasks to a team runner, start with:

1. T01 (architect)
2. T02 (executor)
3. T08 (executor)
4. T21 (test-engineer, blocked by T03/T04/T05/T06)
5. T11 (writer, blocked by T08/T09/T10)

This creates immediate parallelism while preserving dependency correctness.

