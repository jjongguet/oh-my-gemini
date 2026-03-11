# OmG-native Canonical Capability Delta Matrix (OmG vs OmX/OmC)

Date: 2026-03-02  
Canonical ID: C3  
Depends on: C2

This matrix is the implementation-focused parity ledger for team orchestration and role/skill adoption.

---

## 1) Command surface delta

| Delta ID | As-Is (OmG) | Target (OmG-native parity) | Canonical requirements | Primary code/doc surfaces |
|---|---|---|---|---|
| CMD-01 | `team run` is the only lifecycle operator command | Add `team status`, `team resume`, `team shutdown` | PAR-CLI-01/02/03 | `src/cli/index.ts`, `src/cli/commands/team-*.ts`, `commands/omg/team/*`, `docs/omg/commands.md` |
| CMD-02 | Command surface is intentionally small | Keep minimality while adding lifecycle essentials only | PAR-CLI-04, INV-01 | `src/cli/index.ts`, README/docs help output |
| CMD-03 | Extension command set has limited lifecycle control | Extension command prompts and CLI help remain aligned | PAR-CLI-01..04 | `commands/omg/**`, `docs/omg/commands.md` |

---

## 2) Task lifecycle / mutation delta

| Delta ID | As-Is | Target | Canonical requirements | Verification anchor |
|---|---|---|---|---|
| STATE-01 | CAS-style writes exist; first-class control-plane path is incomplete | Lifecycle writes routed through claim/transition/release APIs | PAR-STATE-01 | Reliability tests rejecting direct overwrite paths |
| STATE-02 | Claim field exists but enforcement depth varies | Claim returns token+lease; transitions enforce token validity | PAR-STATE-02/03 | Claim conflict + invalid transition tests |
| STATE-03 | Dependency readiness appears in planning-level semantics, not uniformly enforced | Claim rejects blocked dependencies with deterministic errors | PAR-STATE-04 | Blocked-claim tests |
| STATE-04 | Mailbox APIs exist but lifecycle semantics can drift | Explicit mailbox notified/delivered lifecycle contract | PAR-STATE-05 | Mailbox dedupe/replay tests |
| STATE-05 | Legacy compatibility paths exist | Legacy compatibility remains read-safe but not release-safe for bypass behavior | INV-06 + C7 governance | Release gate checks for bypass usage |

---

## 3) Worker protocol delta

| Delta ID | As-Is | Target | Canonical requirements | Verification anchor |
|---|---|---|---|---|
| WORKER-01 | Worker flow can vary by runtime entrypoint | Mandatory ACK before execution | PAR-WORKER-01 | Live smoke + protocol assertions |
| WORKER-02 | Claim-before-work is not uniformly gate-enforced in all paths | Worker cannot execute without successful claim | PAR-WORKER-02 | Missing-claim failure tests |
| WORKER-03 | Completion reporting schema varies | Structured completion evidence required | PAR-WORKER-03 | Evidence schema tests |
| WORKER-04 | Terminal worker state writing can drift | Deterministic idle/fail terminal worker status | PAR-WORKER-04 | Monitor consistency tests |

---

## 4) Role/skill delta

| Delta ID | As-Is | Target | Canonical requirements | Verification anchor |
|---|---|---|---|---|
| ROLE-01 | Role assignment exists; artifact contracts are uneven | Required role set: planner/executor/verifier with schema-valid outputs | PAR-ROLE-01/02 | Role contract tests |
| ROLE-02 | Skill surface is limited (plan-heavy) | Minimum skill band: `plan`,`execute`,`review`,`verify`,`handoff` | PAR-ROLE-04 | Skill smoke tests |
| ROLE-03 | Verifier behavior may be informational | Verifier artifact can block completion | PAR-ROLE-03 | Failure-path runtime tests |
| ROLE-04 | Reviewer role appears in drafts with mixed requirement level | Reviewer is optional for v1, not gating baseline | C2 optional role decision | Non-blocking checks only |

---

## 5) Runtime backend delta

| Delta ID | As-Is | Target | Canonical requirements | Notes |
|---|---|---|---|---|
| RT-01 | `tmux` path is operationally strong | Preserve tmux default while integrating control-plane semantics | INV-04 + PAR-WORKER-* | Do not shift lifecycle logic into transport-only code |
| RT-02 | `subagents` path can be deterministic/synthetic in parts | Stage to artifact-truthful parity before stronger execution claims | PAR-RT-03 | Keep opt-in until gates are green |
| RT-03 | Completion truth can be inferred too shallowly in some paths | Terminal completion requires task+verify+artifact coherence | PAR-RT-01 | False-green prevention |
| RT-04 | Status truth can drift from runtime reality | Status merges phase/task/worker/runtime sources | PAR-RT-02 | Status truth integration tests |

---

## 6) Security/trust-boundary delta

| Delta ID | As-Is | Target | Canonical requirements |
|---|---|---|---|
| SEC-01 | ID/path sanitization exists across multiple layers | Centralized team/task/worker identifier contract | C4 contracts policy |
| SEC-02 | Legacy compatibility flags can soften strict behavior | Legacy bypass behavior auditable and release-blocked | C7 deprecation governance |
| SEC-03 | State-root safety depends on multiple call-sites | Trusted-root and canonical path enforcement documented/tested | C4 migration constraints |

---

## 7) CI/test gate delta

| Delta ID | As-Is baseline | Required expansion | Canonical requirements |
|---|---|---|---|
| QA-01 | C0/C1/C2 baseline gates | Add lifecycle command gate | C6 GATE-R1 |
| QA-02 | Reliability suites exist | Add control-plane mutation gate | C6 GATE-R2 |
| QA-03 | Integration suites exist | Add role-contract gate | C6 GATE-R3 |
| QA-04 | Docs and command drift checks are partial | Add docs contract gate and later make it blocking | C6 GATE-R4 |
| QA-05 | Publish gate exists | Add legacy bypass enforcement in release path | C6 GATE-R5 + C7 |

---

## 8) Priority order (canonical)

1. **P0 integrity:** CMD-01, STATE-01/02/03, WORKER-01/02, RT-03
2. **P1 operational parity:** CMD-03, WORKER-03/04, RT-04
3. **P1.5 role/skill realization:** ROLE-01/02/03
4. **P2 release safety:** QA-04/05, SEC-02
5. **P3 optional depth:** ROLE-04 and richer subagents behavior

