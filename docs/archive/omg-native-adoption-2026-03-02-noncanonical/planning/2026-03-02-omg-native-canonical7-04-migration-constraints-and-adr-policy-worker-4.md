# OmG-native Canonical 04 — Migration Constraints and ADR Policy (Worker 4)

Date: 2026-03-02  
Status: **Canonical**  
Depends on: C1, C2, C3

## 1) Migration constraints (non-negotiable)

## 1.1 Product/UX constraints

1. Preserve OmG extension-first UX and command ergonomics.
2. Preserve tmux as default backend during this adoption cycle.
3. Add lifecycle commands without breaking existing `omg team run` workflows.

## 1.2 State/mutation constraints

1. Existing canonical state paths remain stable: `.omg/state/team/<team>/...`.
2. Compatibility reads for legacy payloads may remain temporarily; new writes must be canonical.
3. Lifecycle state mutations must move to control-plane APIs only.

## 1.3 Runtime/protocol constraints

1. Worker identity remains `worker-<n>` with `leader-fixed` coordinator alias.
2. Worker protocol sequence (ACK -> claim -> execute -> report -> idle) becomes enforceable runtime contract.
3. Subagents backend remains opt-in until parity gates pass.

## 1.4 Quality/release constraints

1. C0/C1/C2 remain blocking and unchanged in strictness.
2. New adoption gates (C3..C7) must be introduced incrementally with clear promotion rules.
3. Release candidates cannot rely on legacy bypass toggles to pass baseline checks.

## 2) Compatibility and deprecation policy

## 2.1 Compatibility window

- Legacy compatibility behavior is allowed only during Rings 0-1.
- Rings 2-3 require deprecation warnings to become hard failures for release-bound branches.

## 2.2 Deprecation targets

1. Direct lifecycle file edits in runtime paths.
2. Ambiguous phase/gate naming in adoption documentation.
3. Hidden, long-lived legacy env toggles in release workflows.

## 2.3 Deprecation enforcement

- Emit explicit runtime warnings when compatibility paths are used.
- Track compatibility-path usage via CI/lint checks and release gate reports.
- Require ADR signoff before extending any compatibility window.

## 3) ADR set for this program (required)

| ADR ID | Decision | Status |
|---|---|---|
| ADR-OMG-ORCH-001 | Introduce Team Control Plane as single mutation authority | Required |
| ADR-OMG-ORCH-002 | Add `omg team status/resume/shutdown` lifecycle operator commands | Required |
| ADR-OMG-ORCH-003 | Enforce worker protocol as completion precondition | Required |
| ADR-OMG-ROLE-001 | Define role contract v1 (`planner`,`executor`,`verifier`) | Required |
| ADR-OMG-GATE-001 | Expand CI to C0..C7 with promotion/rollback rules | Required |
| ADR-OMG-COMPAT-001 | Time-box compatibility toggles and define removal milestones | Required |

## 4) Decision policy (how conflicts are resolved)

1. If a proposal violates any Section 1 constraint, reject it.
2. If two proposals satisfy constraints, choose the one with smaller migration blast radius.
3. If blast radius is equivalent, choose the one with stronger deterministic verification evidence.
4. If uncertainty remains, require an ADR and do not implement by convention alone.

## 5) Pre-implementation checklist

Before coding a parity item, confirm:

- [ ] Canonical requirement exists in C2/C3.
- [ ] Phase assignment exists in C5.
- [ ] Acceptance/gate evidence path exists in C6.
- [ ] Rollout and rollback implications are recorded in C7.
- [ ] Required ADR status is recorded (accepted or explicitly deferred).

## 6) Migration completion conditions

Migration constraints are satisfied only when:

- compatibility-only paths are no longer required for baseline green,
- canonical operator lifecycle is stable in CI + at least one live rehearsal,
- role evidence contract is enforced by completion/gate logic.
