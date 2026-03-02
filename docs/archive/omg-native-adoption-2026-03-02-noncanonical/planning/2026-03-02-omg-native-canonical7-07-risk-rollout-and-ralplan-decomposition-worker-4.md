# OmG-native Canonical 07 — Risk, Rollout, and Ralplan Decomposition (Worker 4)

Date: 2026-03-02  
Status: **Canonical**  
Depends on: C1, C2, C3, C4, C5, C6

## 1) Canonical risk register

| Risk ID | Risk | Impact | Early signal | Mitigation | Gate linkage |
|---|---|---|---|---|---|
| R1 | Lifecycle commands land without stable state semantics | High | `status/resume/shutdown` tests flaky or inconsistent | Enforce C4 before C3 promotion | C3, C4 |
| R2 | Direct task-file writes reintroduced in runtime paths | High | task JSON changed outside control-plane APIs | Static checks + review guardrails + failure tests | C4 |
| R3 | Worker protocol bypass produces false-green completion | High | workers complete without ACK/claim trail | protocol validator + monitor failure reasons | C4, C5 |
| R4 | Role contract produces artifacts but no schema enforcement | High | malformed artifacts accepted | schema validation + required role checklist | C5 |
| R5 | Subagents backend reports completion without equivalent evidence | High | backend parity mismatch in reliability runs | cross-backend completion checklist parity | C5 |
| R6 | Docs and command surface drift | Medium | CLI help and docs disagree | docs/help contract checks in CI | C6 |
| R7 | Legacy bypass flags become permanent dependency | High | release branch green only with compatibility toggles | time-boxed deprecation + C7 block | C7 |
| R8 | Gate expansion causes CI fatigue/flakiness | Medium | unstable runtimes or prolonged queue times | deterministic contract tests + separated live evidence | C1, C6 |
| R9 | Rollout advances without rollback readiness | High | no validated rollback rehearsal | mandatory rollback drill before ring promotion | C7 |
| R10 | Task decomposition ambiguity causes duplicate/misaligned implementation | Medium | overlapping PRs and conflicting ownership | canonical C5 task graph + owner mapping | C5, C6 |

## 2) Rollout rings (authoritative)

## Ring 0 — Internal design/contract validation

Entry:

- C1..C4 green for targeted scope,
- ADR set accepted.

Exit:

- lifecycle command contracts stable in integration,
- control-plane mutation semantics validated.

## Ring 1 — Maintainer canary

Entry:

- Ring 0 exit complete,
- C5 role-evidence checks enabled for canary runs.

Exit:

- protocol and role-evidence failure rates within tolerance,
- rollback rehearsal executed once.

## Ring 2 — Default-on for maintainers/contributors

Entry:

- C0..C6 green on release-bound branch,
- compatibility-only paths emit warnings and are no longer default.

Exit:

- C7 safety checks pass for two consecutive release-candidate cycles.

## Ring 3 — GA and legacy cleanup

Entry:

- all C0..C7 blocking and green,
- no required reliance on legacy bypass toggles.

Exit:

- legacy compatibility paths removed or hard-disabled for this scope.

## 3) Rollback policy

Rollback triggers:

1. Any C4/C5 regression that allows false-green completion,
2. protocol enforcement causing unacceptable production breakage,
3. inability to pass release baseline without emergency compatibility toggles.

Rollback actions:

- stop ring promotion immediately,
- revert latest ring-bound deltas behind feature flags,
- reopen at previous stable ring with corrective task pack.

## 4) Ralplan-ready decomposition (canonical)

| Task ID | Subject | Depends on | Owner role | Done signal |
|---|---|---|---|---|
| T1 | Freeze canonical docs + ADR set | none | planner/architect | C1..C7 docs + ADR status published |
| T2 | Implement control-plane module shell | T1 | executor | module + unit tests merged |
| T3 | Route task lifecycle writes through control-plane | T2 | executor | no direct write path in new runtime code |
| T4 | Add `omg team status` | T2 | executor | integration tests + docs updated |
| T5 | Add `omg team resume` | T4 | executor | recovery integration path green |
| T6 | Add `omg team shutdown` | T4 | executor | graceful/force tests green |
| T7 | Enforce worker protocol validator | T3 | executor/verifier | protocol violation tests green |
| T8 | Implement role contract v1 + schema validation | T3 | executor/verifier | role schema gate green |
| T9 | Align subagents completion checks with tmux truth contract | T8 | executor | cross-backend parity checks green |
| T10 | Land C3..C7 CI gates + promotion policy | T4,T5,T6,T7,T8,T9 | verifier | gate workflows and docs green |
| T11 | Ringed rollout rehearsal + rollback drill | T10 | qa/verifier | rehearsal evidence attached |
| T12 | Legacy bypass deprecation completion | T11 | executor/verifier | C7 green without bypass |

## 5) Program exit criteria

Program is complete only when:

- T1..T12 are complete,
- rollout reaches Ring 3 without emergency bypass reliance,
- canonical docs remain synchronized with shipped command/runtime behavior.
