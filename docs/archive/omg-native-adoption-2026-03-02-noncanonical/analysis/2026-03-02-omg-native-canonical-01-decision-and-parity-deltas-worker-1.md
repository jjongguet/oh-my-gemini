# Canonical 01 — OmG-native Decision and Parity Deltas (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)  
Scope: Team orchestration + agent role/skill adoption parity

## 1) Final Decision

OmG will **absorb OmC/OmX control-plane rigor** while preserving OmG-native product identity:

- extension-first UX,
- tmux default backend,
- subagents opt-in,
- deterministic durable state,
- verify-gated release discipline.

## 2) Non-Negotiable Parity Targets

### PD-01 Lifecycle operator parity (MUST)
OmG MUST support:

- `omg team run`
- `omg team status`
- `omg team resume`
- `omg team shutdown`

with stable `--json` behavior and deterministic exit codes (`0` success, `1` runtime failure, `2` usage/config error).

### PD-02 Task lifecycle safety parity (MUST)
Lifecycle fields (`status`, `owner`, `result`, `error`) MUST only change through claim-token-guarded APIs:

- `claimTask`
- `transitionTaskStatus`
- `releaseTaskClaim`

Direct lifecycle overwrites in new code paths are forbidden.

### PD-03 Worker protocol parity (MUST)
Worker flow MUST be enforced as:

1. identity resolve,
2. ACK to lead,
3. inbox read,
4. task claim,
5. execution,
6. structured completion result,
7. idle/final worker status update.

### PD-04 Role/skill execution parity (MUST)
Role selection MUST produce contract-bound artifacts (not metadata only). Minimum v1 role band:

- planner,
- executor,
- verifier.

### PD-05 Runtime truthfulness parity (MUST)
`completed` state MUST require:

- terminal task correctness,
- verification baseline pass,
- required role evidence artifacts.

Synthetic/deterministic green without evidence is forbidden for production-grade flows.

## 3) Adopt / Adapt / Reject

## Adopt now

- Lifecycle commands: `status/resume/shutdown`.
- Claim-token task lifecycle semantics.
- Deterministic conflict/lease/CAS failure behavior.
- Worker ACK→claim→result protocol.

## Adapt for OmG

- OmX-style control-plane API pattern (OmG naming/layout).
- Role/skill surface: small high-value set first.
- Durable writes: fsync-strengthened path only for orchestration-critical artifacts.

## Reject (for this adoption cycle)

- Immediate 30+ skill catalog cloning.
- Subagents “default production parity” before runtime evidence hardening.
- Unbounded unsafe/legacy bypass operation in release flows.

## 4) Contradiction Resolutions Locked

1. **Phase count conflict resolved:** canonical program uses **6 phases (0–5)**.
2. **Role breadth conflict resolved:** v1 requires planner/executor/verifier; review/handoff is extension wave.
3. **CLI breadth conflict resolved:** only orchestration-critical expansion is canonical.
4. **Backend strategy conflict resolved:** tmux remains default; subagents remains opt-in until evidence gates pass.

## 5) Mandatory Verification Evidence

Every implementation PR under this program MUST include:

- `npm run typecheck`
- `npm run test` (or equivalent targeted + justified subset)
- `npm run lint`
- `npm run verify`

plus explicit PASS/FAIL command outputs and compatibility notes.

## 6) Canonical Cross-References

- Architecture contract: `2026-03-02-omg-native-canonical-02-target-architecture-and-control-plane-contract-worker-1.md`
- Migration constraints: `2026-03-02-omg-native-canonical-03-migration-constraints-and-policy-worker-1.md`
- Plan/gates/rollout/tasks: canonical 04–07 docs in `docs/planning/`.
