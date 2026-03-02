# OmG-Native Canonical 02 — Capability Delta Matrix and Parity Requirements

Status: **Canonical (authoritative)**  
Date: 2026-03-02

This document defines concrete parity requirements for OmG adoption work.

## 1) Capability parity requirements (normative)

| Req ID | Domain | Parity requirement (must implement) | Acceptance signal |
|---|---|---|---|
| PR-CLI-01 | Lifecycle CLI | Add `omg team status`, `omg team resume`, `omg team shutdown` as first-class commands with JSON mode | Integration tests + help/docs contract checks |
| PR-CLI-02 | Exit semantics | Keep OmG exit-code contract: `0` success, `2` usage/config, `1` runtime failure | Command contract tests |
| PR-CP-01 | Claim semantics | Implement claim API with owner token + lease metadata and deterministic conflict handling | Reliability tests for contention + stale lease |
| PR-CP-02 | Transition semantics | Implement guarded transition API (`from`,`to`,`claimToken`) with invalid-transition rejection | Reliability negative-path tests |
| PR-CP-03 | Release semantics | Implement release API with owner/token validation and deterministic rollback to claim-free state | Reliability tests |
| PR-CP-04 | Mutation policy | Disallow raw lifecycle field overwrites in new runtime paths | Static + runtime assertions in tests |
| PR-WP-01 | Worker protocol | Enforce ACK -> claim -> execute -> result -> idle sequence in tmux worker path | Worker-protocol gate tests |
| PR-WP-02 | Failure taxonomy | Emit deterministic reason codes for protocol/control-plane failures | Snapshot assertions + monitor checks |
| PR-RS-01 | Role contract v1 | Require schema outputs for `planner`, `executor`, `verifier` | Role artifact validation tests |
| PR-RS-02 | Artifact durability | Persist role artifacts under deterministic team artifact paths | Integration tests on artifact references |
| PR-RS-03 | Role-skill mapping | Maintain explicit mapping for `plan`, `team`, `review`, `verify`, `handoff` | Mapping validation in CI |
| PR-RT-01 | Runtime truthfulness | Keep tmux default; subagents cannot claim completion without evidence artifacts | Runtime integration + reliability checks |
| PR-SEC-01 | Trust boundary | Validate team/worker/task identifiers and state-root policy before mutation | Contract tests for invalid IDs/paths |
| PR-OBS-01 | Observability | Persist auditable team events for claim/transition/protocol lifecycle | Event log assertions |
| PR-GATE-01 | Quality gates | Expand C0/C1/C2 with C3..C7 adoption gates before GA | CI evidence bundle |
| PR-GATE-02 | Legacy safeguards | Release pipeline must fail when legacy bypass toggles are required for baseline success | Gate enforcement test |

## 2) Adopt / adapt / reject summary

- **Adopt now**: control-plane lifecycle rigor, lifecycle CLI parity, worker protocol enforcement.
- **Adapt now**: role/skill workflow semantics using OmG extension-first conventions.
- **Reject for this cycle**: broad command/skill surface cloning from OmC/OmX.

## 3) Definition of parity completion

Parity is complete only when PR-CLI/PR-CP/PR-WP/PR-RS/PR-RT/PR-SEC/PR-OBS/PR-GATE requirements all pass in blocking CI and in at least one live operator runbook rehearsal.
