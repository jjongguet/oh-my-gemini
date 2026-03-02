# Canonical 07 — OmG-native Ralplan Task Decomposition (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Canonical Role Mix

Minimum role set:

- planner
- architect
- executor
- test-engineer
- verifier
- writer

## 2) Execution Rules

1. Lifecycle fields cannot change outside claim-token path.
2. Every code task must include fresh verification evidence.
3. Shared-file tasks must declare dependencies.
4. No default-on change before corresponding gate task is done.

## 3) Canonical Task Graph

## Track A — Control-plane foundation

- **A1** Define contracts/invariants (IDs, transitions, reason codes)
- **A2** Implement `claimTask`
- **A3** Implement `transitionTaskStatus`
- **A4** Implement `releaseTaskClaim`
- **A5** Add dependency-readiness checks
- **A6** Add mailbox lifecycle helpers
- **A7** Publish state schema + lifecycle docs

## Track B — Lifecycle CLI parity

- **B1** Add `omg team status`
- **B2** Add `omg team resume`
- **B3** Add `omg team shutdown`
- **B4** Sync README/docs/help/extension command examples

## Track C — Worker/runtime hardening

- **C1** Standardize worker protocol template
- **C2** Wire tmux worker flow to claim-first protocol
- **C3** Enforce structured completion evidence
- **C4** Add failure reason taxonomy and monitor surfacing

## Track D — Role/skill execution

- **D1** Define planner/executor/verifier artifact schema
- **D2** Emit role artifacts in runtime
- **D3** Enforce verifier artifact impact on terminal status
- **D4** Expand minimal extension skill pack (execute/review/verify/handoff)
- **D5** Publish role→skill→artifact contract doc

## Track E — Gates and rollout readiness

- **E1** Add control-plane reliability gate
- **E2** Add lifecycle CLI integration gate
- **E3** Add role contract gate
- **E4** Add docs contract drift gate
- **E5** Block legacy bypass in release jobs
- **E6** Final regression and go/no-go evidence pack

## 4) Dependency Skeleton

- A1 blocks A2–A7
- A2 blocks A3/A4/A5 and B2/B3/C2
- B1 blocks B2/B3/B4
- C1 blocks C2/C3
- D1 blocks D2/D3/D4/D5
- E1 depends on A-track completion
- E2 depends on B-track completion
- E3 depends on D-track completion
- E6 depends on E1–E5 + documentation sync

## 5) Definition of Done per Task

Each task is complete only when:

1. implementation/docs are landed,
2. acceptance criteria are met,
3. required verification commands are executed,
4. PASS/FAIL evidence is attached,
5. compatibility impact is explicitly stated.
