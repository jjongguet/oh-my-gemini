# OmG-native Canonical C7 — Risk, Rollout, and Deprecation Governance

Date: 2026-03-02  
Status: Authoritative

---

## 1) Canonical risk register

| Risk ID | Risk | Score (LxI) | Trigger | Mitigation |
|---|---|---:|---|---|
| R1 | Lifecycle mutation bypass causes state divergence | 20 | task status changed without claim trail | enforce control-plane-only mutation paths + C3 gate |
| R2 | Protocol non-compliance produces false-green completions | 20 | missing ACK/claim/evidence but run reported complete | protocol enforcement + C5 gate |
| R3 | Role schema remains nominal (no usable artifacts) | 16 | roles complete without schema-valid output | schema validator + C6 gate |
| R4 | Lifecycle docs drift from CLI/help/prompts | 12 | users see documented command not implemented | docs contract checks + C7 gate |
| R5 | Subagents over-report completion realism | 12 | deterministic completed snapshot without evidence | staged subagent evidence model + C6/C7 checks |
| R6 | Legacy bypass flags hide real failures | 15 | release green only with legacy toggles | release policy that fails on bypass dependency |
| R7 | Control-plane changes regress tmux stability | 10 | frequent stale sessions or failed cleanup | integration/live smoke + rollback-ready shutdown path |
| R8 | CI duration growth slows delivery | 9 | PR loop delay from heavy new suites | targeted suites + staged gate activation |

Priority order: **R1 -> R2 -> R6 -> R3 -> R4/R5 -> R7/R8**.

---

## 2) Rollout rings

| Ring | Scope | Entry condition | Exit condition |
|---|---|---|---|
| Ring 0 (internal) | feature-flag validation | C3/C4 baseline tests passing | no high-severity issues in internal runs |
| Ring 1 (maintainer canary) | daily tmux team workflows | lifecycle commands used in real runs | 3 consecutive green canary cycles |
| Ring 2 (beta default for contributors) | lifecycle commands become standard path | C3..C6 stable | one release cycle without P0 regressions |
| Ring 3 (strict GA) | full governance mode | C3..C7 blocking and green | two release cycles without critical regressions |

---

## 3) Rollback policy

Rollback triggers:

1. unrecoverable state corruption,
2. non-deterministic task ownership/lifecycle outcomes,
3. repeated operator failure on resume/shutdown,
4. release readiness requiring legacy bypass toggles.

Rollback actions:

1. disable strict new behavior via feature flag,
2. preserve baseline `team run` path,
3. keep compatibility readers active,
4. publish incident summary + new regression tests before re-enable.

---

## 4) Deprecation governance

### 4.1 Document governance

- The 26 source docs mapped in C1 are non-canonical.
- New synthesis/planning work must update C1..C7 directly.

### 4.2 Feature-flag governance

- Legacy compatibility flags may exist during migration, but:
  - must be audited,
  - must be logged,
  - must not be required for release baseline success.

### 4.3 Sunset rule

A legacy toggle can be removed when both are true:

1. equivalent canonical behavior has passed C3..C7 for at least one full release cycle,
2. rollback rehearsal proves no data-loss or operator dead-end.
