# OmG-Native Canonical 06 — Risk Register, Rollout, and Rollback

Status: **Canonical (authoritative)**  
Date: 2026-03-02

## 1) Priority risk register (canonical)

| Risk ID | Risk | Priority | Mitigation |
|---|---|---:|---|
| R1 | Direct lifecycle writes bypass control-plane invariants | Critical | Block bypass in strict mode + C3 enforcement |
| R2 | Subagents false-green completion without evidence | Critical | C6 role-evidence enforcement + staged rollout |
| R3 | Legacy toggles masking failures | High | C7 release blocking + telemetry/audit |
| R4 | Lifecycle commands drift from docs/help/prompts | High | Docs contract checks in C7 |
| R5 | Worker protocol non-compliance in tmux path | High | C5 protocol tests + runtime failure taxonomy |
| R6 | State schema migration breaks compatibility | High | Additive migration + compatibility-read tests |
| R7 | Rollout regressions in shutdown/resume paths | Medium | Ringed rollout + rollback rehearsal |
| R8 | Role/skill mapping drift | Medium | Mapping contract checks + explicit unsupported-role failures |

## 2) Rollout model (resolved)

Rollout terminology is fixed to **Ring 0..3**:

- **Ring 0 (internal/flagged)**: control-plane + lifecycle contracts behind opt-in switches.
- **Ring 1 (maintainer canary)**: daily operational use with strict evidence capture.
- **Ring 2 (default lifecycle)**: lifecycle commands default-on; role checks warning->strict transition.
- **Ring 3 (strict GA)**: C3..C7 fully blocking; legacy bypasses removed/restricted.

## 3) Ring promotion criteria

- Ring 0 -> 1: reliability + integration evidence for PR-CP and PR-CLI requirements.
- Ring 1 -> 2: no critical lifecycle/protocol incidents for one release cycle.
- Ring 2 -> 3: two consecutive release cycles with C3..C7 green and no P0 migration defects.

## 4) Rollback policy

Rollback triggers:

1. non-deterministic task ownership/state corruption,
2. unrecoverable resume/shutdown failures,
3. repeated role-evidence contract false results.

Rollback actions:

1. disable newest strictness feature flag,
2. preserve compatibility readers and existing stable command path,
3. publish incident summary + new guardrail test requirements,
4. re-enter previous ring until exit criteria are re-proven.
