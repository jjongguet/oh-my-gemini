# Worker 1 Bootstrap — OmX/OmC Control-Plane Parity Lift

Date: 2026-03-02  
Scope: Team orchestration + worker-role/skill execution safety

## 1) Adversarial gap analysis (As-Is)

### Gap A — lifecycle mutation bypass risk

- `TeamStateStore` offers CAS and canonical paths, but runtime/worker integrations still lacked a first-class lifecycle API surface that enforces **claim-token ownership + lease validity** before status transitions.
- Risk: any caller can accidentally (or adversarially) write task lifecycle fields out of order.

### Gap B — dependency-aware claim safety not enforced

- Dependency metadata exists (`dependsOn`/`depends_on`) but claim behavior had no central contract to reject claims on unresolved dependencies.
- Risk: downstream work starts before upstream required tasks complete.

### Gap C — mailbox notified/delivered semantics are append-only data, not behavior

- Mailbox schema includes `notifiedAt` / `deliveredAt`, but there was no OMP-native mutation/read contract for idempotent message lifecycle handling.
- Risk: duplicate lifecycle updates and inconsistent consumer views.

## 2) Implemented OMP-native parity lift

### New module: `src/team/control-plane/`

- `task-lifecycle.ts`
  - `claimTask(...)` with dependency gating + lease-token issuance
  - `transitionTaskStatus(...)` with claim-token/lease/from-status guards
  - `releaseTaskClaim(...)` for safe claim rollback
- `mailbox-lifecycle.ts`
  - `sendMessage(...)`
  - `listMessages(...)` with message-id collapse over append-only timeline
  - `markMessageNotified(...)` and `markMessageDelivered(...)` (idempotent)
- `index.ts`
  - `TeamControlPlane` facade
  - convenience delegates for task + mailbox APIs
- `src/team/index.ts`
  - exports control-plane APIs as public team surface

## 3) Verification-focused test coverage

Added: `tests/reliability/team-control-plane.test.ts`

Covers:

1. dependency enforcement before claim
2. claim ownership conflict rejection
3. lease expiry rejection + token mismatch rejection
4. terminal transition clears claim
5. release claim rollback to pending
6. mailbox notified/delivered lifecycle idempotency and undelivered filtering

## 4) Docs synchronization

Updated:

- `docs/architecture/state-schema.md`
  - explicit control-plane mutation semantics section
- `docs/architecture/runtime-backend.md`
  - control-plane mediation requirement for task/mailbox lifecycle mutations

## 5) Why this is OmX/OmC-grade aligned

This change closes a core parity gap: **state schema alone** is no longer the only contract; now an executable control-plane layer enforces critical lifecycle invariants (claim/lease/token/dependency/mailbox lifecycle) required for deterministic multi-worker orchestration.
