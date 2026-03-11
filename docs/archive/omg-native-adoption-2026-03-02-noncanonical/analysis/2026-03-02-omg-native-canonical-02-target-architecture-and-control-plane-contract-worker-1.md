# Canonical 02 — OmG-native Target Architecture and Control-Plane Contract (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Architecture Layers (Authoritative)

1. **Public UX layer**: `package root extension surface`, `src/cli/**`
2. **Orchestrator layer**: `src/team/team-orchestrator.ts`
3. **Runtime transport layer**: `src/team/runtime/**` (tmux default, subagents opt-in)
4. **Control-plane layer (new authoritative layer)**: `src/team/control-plane/**`
5. **Durable state layer**: `src/state/team-state-store.ts`, filesystem helpers
6. **Verification/gate layer**: `verify` command, CI gates, reliability/integration tests

## 2) Control-Plane Contract (Normative)

## CP-01 Lifecycle APIs (MUST)

Control-plane MUST expose task lifecycle operations:

- `claimTask(team, taskId, worker, expectedVersion?)`
- `transitionTaskStatus(team, taskId, from, to, claimToken)`
- `releaseTaskClaim(team, taskId, claimToken, worker)`

## CP-02 Transition legality (MUST)

Control-plane MUST enforce legal state transitions and reject illegal transitions deterministically.

## CP-03 Claim safety (MUST)

- Claim token + lease metadata REQUIRED for claimed tasks.
- Claim conflicts and expired leases MUST produce deterministic failures.
- Dependency-blocked claims MUST include blocked dependency IDs.

## CP-04 Write path discipline (MUST)

New lifecycle code paths MUST route through control-plane APIs only; no direct lifecycle field overwrite in raw task writes.

## 3) Worker Protocol Contract (Normative)

## WP-01 Required sequence

1. Resolve worker identity and team state root.
2. Send ACK to lead mailbox.
3. Read worker inbox/task assignment.
4. Claim task.
5. Execute.
6. Write structured result.
7. Write worker terminal state (`idle`/`blocked`/`failed`).

## WP-02 Completion evidence contract

A completed task MUST include structured verification evidence:

- command(s) run,
- PASS/FAIL outcome,
- notable outputs or failure reason.

## 4) Role→Artifact Contract (v1)

Authoritative minimum contract:

- **planner artifact**: decomposition, dependencies, acceptance criteria
- **executor artifact**: implementation summary + command evidence + changed areas
- **verifier artifact**: PASS/FAIL evidence + regression assessment

Recommended path:

`.omg/state/team/<team>/artifacts/<role>/...`

## 5) Runtime Boundary Rules

## RB-01 tmux backend

tmux backend owns runtime process transport (spawn/monitor/shutdown), not lifecycle policy.

## RB-02 subagents backend

subagents backend cannot claim production parity until artifact-backed truthfulness gates pass.

## RB-03 Completion truth model

`completed` requires:

- legal task terminality,
- runtime health consistency,
- verifier/evidence contract satisfaction.

## 6) File-Level Implementation Map (Canonical)

### Expected new/expanded code areas

- `src/team/contracts.ts`
- `src/team/control-plane/*`
- `src/cli/commands/team-status.ts`
- `src/cli/commands/team-resume.ts`
- `src/cli/commands/team-shutdown.ts`
- `src/team/runtime/tmux-backend.ts` (protocol wiring)
- `src/team/runtime/subagents-backend.ts` (truthfulness evolution)

### Required docs/test alignment

- command docs + extension prompts
- state schema docs
- reliability + integration coverage for lifecycle and role artifacts

## 7) Forbidden Patterns

1. Runtime/backend code mutating task lifecycle fields directly.
2. Marking tasks complete without claim/evidence contract.
3. Introducing breaking state path renames under `.omg/state`.
4. Exposing lifecycle commands publicly before gate coverage.
