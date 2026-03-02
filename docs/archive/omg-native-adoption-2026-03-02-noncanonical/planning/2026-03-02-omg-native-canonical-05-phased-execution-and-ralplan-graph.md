# OmG-native Canonical Phased Execution and ralplan Dependency Graph

Date: 2026-03-02  
Canonical ID: C5  
Depends on: C2, C3, C4

---

## 1) Canonical phase model (fixed)

| Phase | Objective | Primary outputs | Exit criteria |
|---|---|---|---|
| 0 | Design/contract lock | control-plane contract, transition matrix, role artifact schema v1 | no unresolved contract ambiguity |
| 1 | Control-plane foundation | claim/transition/release APIs + dependency readiness + tests | deterministic lifecycle mutation behavior |
| 2 | Lifecycle CLI parity | `team status/resume/shutdown` + docs/help alignment | operator lifecycle commands stable and test-covered |
| 3 | Worker protocol hardening | ACK->claim->execute->report->idle runtime enforcement | non-compliant worker paths fail deterministically |
| 4 | Role/skill contract realization | planner/executor/verifier artifact contract + minimal skill set | role outputs are schema-valid and verifier-binding |
| 5 | Reliability + rollout hardening | gate expansion, legacy bypass governance, rollout playbooks | release path blocks unsafe states and false-green |

---

## 2) Canonical task graph (dependency-ordered)

### 2.1 Task IDs

| Task ID | Subject | Phase | Deps | Requires code |
|---|---|---|---|---|
| T01 | Finalize control-plane API contract | 0 | - | No |
| T02 | Implement claim lock + stale lock handling | 1 | T01 | Yes |
| T03 | Implement `claimTask` | 1 | T01,T02 | Yes |
| T04 | Implement `transitionTaskStatus` | 1 | T03 | Yes |
| T05 | Implement `releaseTaskClaim` | 1 | T03 | Yes |
| T06 | Implement dependency-readiness claim guard | 1 | T03 | Yes |
| T07 | Publish state/lifecycle contract docs | 1 | T03,T04,T05,T06 | No |
| T08 | Add `omg team status` | 2 | T01 | Yes |
| T09 | Add `omg team shutdown` | 2 | T08 | Yes |
| T10 | Add `omg team resume` | 2 | T08 | Yes |
| T11 | Sync README/docs/help/prompt surfaces | 2 | T08,T09,T10 | No |
| T12 | Standardize worker protocol template | 3 | T01 | Yes |
| T13 | Wire tmux dispatch to claim-first protocol | 3 | T12,T03 | Yes |
| T14 | Enforce completion evidence payload | 3 | T13,T04 | Yes |
| T15 | Add monitor reason taxonomy | 3 | T04,T13 | Yes |
| T16 | Add extension skill: `execute` | 4 | T01 | Yes |
| T17 | Add extension skill: `review` | 4 | T16 | Yes |
| T18 | Add extension skill: `verify` | 4 | T17 | Yes |
| T19 | Add extension skill: `handoff` | 4 | T18 | Yes |
| T20 | Publish role->skill->artifact contract doc | 4 | T16,T17,T18,T19 | No |
| T21 | Add control-plane reliability suite | 5 | T03,T04,T05,T06 | Yes |
| T22 | Add lifecycle command integration suite | 5 | T08,T09,T10 | Yes |
| T23 | Add blocking gate: team-control-plane | 5 | T21,T22 | Yes |
| T24 | Add legacy bypass detection/blocking in release path | 5 | T23 | Yes |
| T25 | Run full regression + publish-readiness decision | 5 | T11,T15,T20,T23,T24 | No |

### 2.2 Critical path

`T01 -> T02 -> T03 -> T04 -> T13 -> T14 -> T21 -> T23 -> T24 -> T25`

### 2.3 Safe parallelization windows

- Window A: `T08` in parallel with `T02/T03` after `T01`
- Window B: `T12` in parallel with `T08/T09/T10` once `T01` exists
- Window C: `T16` in parallel with late Phase 3 tasks (does not block control-plane correctness)

---

## 3) Phase-wise acceptance package

| Phase | Required acceptance package |
|---|---|
| 0 | contract review sign-off (architect + verifier + writer) |
| 1 | deterministic claim/transition/release reliability evidence |
| 2 | lifecycle command integration evidence (`status/resume/shutdown`) |
| 3 | protocol-enforcement evidence from runtime and monitor snapshots |
| 4 | role artifact schema evidence + verifier-failure path proof |
| 5 | full gate evidence + rollout readiness + rollback checklist |

---

## 4) Canonical execution rules

1. No lifecycle field writes outside control-plane APIs after T03.
2. No phase promotion without phase exit evidence.
3. No release promotion with legacy bypass toggles active.
4. No docs/help prompt drift for lifecycle commands.
5. No role support claims without artifact-schema evidence.

---

## 5) Minimal command evidence bundle per milestone

```bash
npm run typecheck
npm run test:reliability
npm run test:integration
npm run verify -- --json
```

Final release-readiness bundle (T25):

```bash
npm run typecheck && npm run test && npm run verify && npm run gate:publish
```

