# Canonical 03 — OmG-native Migration Constraints and Governance Policy (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Migration Constraints (Non-Negotiable)

## MC-01 Product identity

OmG MUST remain extension-first with tmux-default runtime posture.

## MC-02 Backward readability

Existing state paths and legacy readers MUST remain readable during migration:

- `.omg/state/team/<team>/tasks/task-<id>.json`
- legacy compatibility reads already promised by store layer
- phase normalization compatibility (`complete` → `completed`)

## MC-03 Additive schema policy

Schema evolution MUST be additive-first. Breaking rename/removal requires explicit migration phase, compatibility tests, and release notes.

## MC-04 Verification before defaults

No default-on rollout for lifecycle/role/runtime deltas before acceptance gates pass.

## MC-05 Docs-as-contract

README, docs, extension prompts, and CLI help MUST be synchronized for any command or contract change.

## 2) Security and Trust-Boundary Policy

## SC-01 Identifier contracts

Team/worker/task IDs MUST be centrally validated by shared regex contracts.

## SC-02 State-root policy

State root access MUST be constrained to trusted/canonical roots; untrusted roots must fail fast.

## SC-03 Legacy bypass governance

Legacy/compatibility bypass env usage MUST be:

- auditable (events + reason codes),
- disabled by default in release gates,
- blocked in publish/release paths once migration enters GA stage.

## 3) Operational Governance

## OG-01 Source-of-truth order

Topic authority is fixed:

1. Decision/parity: canonical 01
2. Architecture/contracts: canonical 02
3. Constraints/policy: canonical 03
4. Execution sequencing: canonical 04
5. Quality gates: canonical 05
6. Rollout operations: canonical 06
7. Task decomposition: canonical 07

## OG-02 Conflict handling

If two docs conflict, higher authority for that topic wins; lower doc must be updated to match before implementation proceeds.

## 4) Adopt / Adapt / Reject Governance Table

| Item | Policy | Governance reason |
|---|---|---|
| Claim-token lifecycle semantics | Adopt | Core integrity requirement |
| Lifecycle operator commands | Adopt | Minimum operability contract |
| Role contract enforcement | Adopt | Required for truthful completion |
| Massive skill catalog import | Reject (current cycle) | Scope and verification risk |
| Subagents default parity claims | Reject until gates pass | Prevent false-green and trust loss |
| Fsync-strengthened writes for critical files | Adapt | Reliability without global performance penalty |

## 5) Mandatory Compatibility Evidence

Every migration phase MUST provide explicit evidence for:

1. state schema compatibility,
2. command contract compatibility,
3. role artifact schema compatibility,
4. deterministic error semantics for invalid lifecycle operations.

## 6) Exit Conditions for Constraint Compliance

Migration governance remains compliant only if all are true:

- no breaking `.omg/state` drift without migration path,
- no ungated lifecycle/role runtime behavior,
- no undocumented command drift,
- no hidden legacy bypass in release path.
