# OmG-native Canonical C3 — Capability Parity Requirements

Date: 2026-03-02  
Status: Authoritative

This document defines implementation-level parity requirements for OmG adoption.

---

## 1) Parity requirement register (normative)

| Req ID | Domain | Requirement (must) | Current OmG baseline | Required implementation surface |
|---|---|---|---|---|
| PR-CLI-01 | Lifecycle CLI | Provide `team status|resume|shutdown` alongside existing `team run` | `src/cli/index.ts` accepts only `team run` | `src/cli/index.ts`, new `src/cli/commands/team-{status,resume,shutdown}.ts`, docs/extension updates |
| PR-CLI-02 | Exit contract | Preserve exit codes `0=success`, `2=usage/config`, `1=runtime` | Already used by existing CLI handlers | Tests for lifecycle commands and help output |
| PR-CP-01 | Claim API | Add claim API with owner/token/lease + deterministic contention behavior | `TeamStateStore.writeTask` CAS exists, no first-class claim API | new `src/team/control-plane/task-lifecycle.ts` |
| PR-CP-02 | Transition API | Add guarded status transition API (`from`,`to`,`claimToken`) | status writes can still happen via generic write path | new control-plane transition guard + tests |
| PR-CP-03 | Release API | Add explicit release API for claim cleanup and stale-claim handling | no explicit claim release contract | new release API + reliability tests |
| PR-CP-04 | Mutation safety | Forbid new lifecycle paths that bypass control-plane APIs | raw write path still available | orchestrator/runtime integration + assertions |
| PR-WP-01 | Worker protocol | Enforce sequence ACK -> claim -> execute -> result -> idle | protocol currently instruction-level, not fully hard-enforced | worker bootstrap contract + runtime checks |
| PR-WP-02 | Protocol diagnostics | Emit reason codes for protocol violations and lifecycle errors | partial summary/failure strings | reason-code taxonomy + snapshot fields |
| PR-RS-01 | Role schema v1 | Validate required outputs for `planner`,`executor`,`verifier` | role selection exists; evidence contract shallow | `src/team/role-contracts.ts` + schema validator |
| PR-RS-02 | Skill mapping | Map `plan/team/review/verify/handoff` to stable role/runtime contracts | extension skill surface currently minimal | extension skill docs/prompt contract updates |
| PR-RS-03 | Artifact durability | Persist role artifacts under deterministic team artifact paths | no canonical artifact contract | `.omg/state/team/<team>/artifacts/*` conventions + checks |
| PR-RT-01 | Runtime truthfulness | Keep tmux default; subagents cannot report production-complete without evidence | tmux bootstrap is lightweight; subagents deterministic synthetic completion | runtime monitor and success checklist hardening |
| PR-COMP-01 | Compatibility | Keep additive read compatibility for existing task/mailbox records | legacy path support exists in TeamStateStore | preserve canonical + legacy readers during migration |
| PR-GATE-01 | Gate expansion | Make adoption gates blocking before GA | C0/C1/C2 exist | add C3..C7 in CI/release workflow |
| PR-GATE-02 | Legacy bypass policy | Release must fail when legacy bypass toggles are required for baseline | legacy toggles still exist | CI policy + governance checks |

---

## 2) Required parity evidence

Each requirement needs at least one of:

1. reliability test evidence,
2. integration command evidence,
3. docs/help/extension contract evidence,
4. live operator rehearsal evidence (for rollout gates).

---

## 3) Hard failure conditions (cannot ship)

1. lifecycle command exists but not contract-tested.
2. task status can be overwritten without claim-token path.
3. verifier artifacts missing but run still marked successful.
4. docs/prompts advertise commands that CLI does not implement.
5. release pipeline passes only when legacy bypass toggles are active.
