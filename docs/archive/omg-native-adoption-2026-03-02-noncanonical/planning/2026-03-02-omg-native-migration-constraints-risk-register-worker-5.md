# OmG-native migration constraints + risk register (Worker 5)

Date: 2026-03-02  
Author: worker-5  
Scope: constraints that must shape implementation order, and a risk register for OmC/OmX capability adoption in OmG.

---

## 1) Migration constraints (non-negotiable)

## 1.1 Product and UX constraints

1. **Keep `omg team run` stable while adding lifecycle commands**
   - Existing usage docs and scripts rely on `team run`.
   - Migration must be additive first (`status/resume/shutdown`), then progressive hardening.

2. **Preserve extension-first experience**
   - `package root extension surface` remains first-class UX surface.
   - New lifecycle and role/skill features must appear consistently in both CLI docs and extension command prompts.

3. **Do not regress minimal default posture**
   - tmux remains default backend.
   - subagents remains opt-in until parity criteria are met.

## 1.2 Architecture and state constraints

4. **State schema compatibility must be maintained during transition**
   - Existing compatibility behavior in state docs includes legacy reads (`tasks/<id>.json`, legacy mailbox json payloads).
   - New control-plane semantics cannot break old state readers abruptly.

5. **Respect worker id + task id canonical formats**
   - Worker IDs: `worker-<n>`.
   - API task id: bare numeric string (`"1"`), file path uses `task-1.json`.

6. **Serialized state writes remain mandatory**
   - Task/mailbox writes must remain funneled through state-store semantics; avoid ad-hoc writes in new code paths.

7. **Legacy compatibility flags currently exist and must be sunset carefully**
   - `OMG_LEGACY_RUNNING_SUCCESS`
   - `OMG_LEGACY_VERIFY_GATE_PASS`
   - Sunset requires staged warnings and explicit CI policy.

## 1.3 Runtime and protocol constraints

8. **Worker protocol must support mixed maturity during rollout**
   - Existing overlays may still rely on file-level reporting.
   - New protocol enforcement must include compatibility phase before strict fail mode.

9. **Environment variable namespace transition is sensitive**
   - Current tmux worker path exports `OMX_TEAM_*` names.
   - OmG-native rename to `OMG_TEAM_*` requires dual-read and deprecation window.

10. **Watchdog/non-reporting thresholds must remain tunable**
    - CLI and env threshold controls are part of current reliability contract.

## 1.4 Testing and release constraints

11. **C0/C1/C2 gates remain blocking**
    - C0: install/consumer/global contract.
    - C1: quality baseline (typecheck/build/smoke/integration/reliability/verify).
    - C2: publish gate.

12. **Adoption work must include live operator evidence path**
    - Current live team e2e runbook still uses OmX team lifecycle.
    - Migration must replace this with OmG-native e2e without losing evidence quality.

---

## 2) Constraint-driven implementation policy

1. **Additive-first**: introduce new APIs/commands before deprecating old paths.
2. **Dual-read compatibility window**: support old and new state/env names in read paths first.
3. **Single-write target**: write only new canonical format once guardrails are in place.
4. **Gate-backed deprecation**: each removed compatibility path needs explicit CI check.
5. **Operator-safe rollout**: lifecycle control should be validated in canary before defaulting.

---

## 3) Risk register

Scale: Probability (P) and Impact (I) from 1 (low) to 5 (high). Priority = `P * I`.

| ID | Risk | P | I | Priority | Trigger signal | Mitigation | Contingency |
|---|---|---:|---:|---:|---|---|---|
| R-01 | Team status truth diverges from runtime reality | 3 | 5 | 15 | `status` reports healthy while workers are dead/non-reporting | Build status from merged runtime + persisted worker telemetry | Force `status --deep` mode and block completion when mismatch found |
| R-02 | Direct file writes bypass lifecycle invariants | 4 | 5 | 20 | Task state changes without claim/transition evidence | Route all lifecycle writes through control-plane/state API | Compatibility mode auto-fails in strict CI stage |
| R-03 | Legacy flags produce false-green completion | 3 | 5 | 15 | Runs complete with verify baseline missing | Warn now, block in strict gate milestone | Emergency env override allowed only in debug profile |
| R-04 | Namespace migration (`OMX_*` -> `OMG_*`) breaks worker startup | 4 | 4 | 16 | Worker bootstrap fails in tmux during mixed environments | Dual-write env exports; dual-read parser; migration telemetry | One-release rollback to dual-mode default |
| R-05 | Role catalog and extension skill surface drift apart | 4 | 4 | 16 | Role appears in catalog but has no contract/skill mapping | Add generated role-skill mapping contract artifact in CI | Temporarily mark unsupported roles as blocked with explicit reason |
| R-06 | Subagents backend over-promoted before operational parity | 3 | 4 | 12 | users run into deterministic/limited behavior unexpectedly | Keep opt-in + explicit experimental diagnostics | Auto-fallback guidance to tmux with preserved task context |
| R-07 | Lifecycle command additions break CLI UX consistency | 2 | 4 | 8 | help/docs/tests disagree on command syntax | Single command contract source + docs snapshot tests | Hotfix docs/CLI parser pair in same patch |
| R-08 | New control-plane tests are flaky in CI (tmux timing) | 3 | 4 | 12 | intermittent e2e failures | deterministic polling/backoff + pane budget preflight | isolate flaky live test from blocking gate until hardened |
| R-09 | Security hardening introduces over-restriction | 2 | 4 | 8 | valid workdirs/IDs rejected unexpectedly | staged warn mode + telemetry sampling | allowlist override with audit log |
| R-10 | Rollout fatigue from too many simultaneous deltas | 3 | 3 | 9 | incomplete features across commands/docs/tests | phase-limited scope and strict DoD per phase | cut lower-priority scope (P2) before shipping |

---

## 4) Top-priority risks to manage first

1. **R-02 direct-write bypass** (Priority 20)
2. **R-04 namespace migration breakage** (Priority 16)
3. **R-05 role/skill drift** (Priority 16)
4. **R-01 status truth divergence** (Priority 15)
5. **R-03 legacy false-green** (Priority 15)

---

## 5) Risk ownership model

| Risk class | Suggested owner role | Review cadence |
|---|---|---|
| State/lifecycle integrity | architect + verifier | every PR touching `src/state` or `src/team` |
| CLI/operator UX | planner + executor + writer | every CLI feature increment |
| Role/skill contract | planner + quality-reviewer | weekly until coverage stabilizes |
| Reliability + CI | test-engineer + build-fixer | every gate change |

---

## 6) Exit conditions for migration risk phase

The migration-risk phase is considered closed only when:

1. lifecycle commands are GA and operator runbook no longer depends on OmX commands,
2. compatibility flags are removed or strictly non-release,
3. role-skill coverage report is generated in CI and has no unresolved P0 roles,
4. live e2e and reliability suites are stable for two consecutive release cycles.
