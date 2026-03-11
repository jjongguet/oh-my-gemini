# OmG-native Adoption Plan — Phased Execution, Acceptance Criteria, and CI/Test Gates

Date: 2026-03-02  
Depends on: `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md`

---

## 1) Planning Principles

1. Preserve OmG’s extension-first architecture.
2. Keep tmux default backend; do not prematurely default subagents.
3. Land control-plane correctness before UX expansion.
4. Treat verification evidence as first-class deliverable.

---

## 2) Phase Plan

## Phase 0 — Control Plane Contract Foundation (P0)

### Scope

- Add lifecycle-safe task APIs in OmG code:
  - claim,
  - transition,
  - release,
  - dependency-readiness check.
- Introduce claim token + lease semantics.
- Add claim-lock primitives for cross-process safety.

### Candidate file areas

- `src/team/*` (new control-plane module)
- `src/state/team-state-store.ts`
- `src/state/types.ts`
- `docs/architecture/state-schema.md`

### Acceptance criteria

- Claim conflicts are deterministic.
- Stale/invalid claim token transitions fail deterministically.
- Dependency-blocked task claims are rejected with explicit dependency IDs.
- Lifecycle writes remain monotonic/version-safe.

### Verification commands

```bash
npm run typecheck
npm run test:reliability
```

---

## Phase 1 — Team Lifecycle Operator Commands (P0)

### Scope

- Add OmG lifecycle commands:
  - `omg team status`
  - `omg team resume`
  - `omg team shutdown`
- Keep existing `team run` behavior backward compatible.

### Candidate file areas

- `src/cli/index.ts`
- new `src/cli/commands/team-*.ts`
- `src/team/team-orchestrator.ts`
- `docs/omg/commands.md`

### Acceptance criteria

- Status command surfaces phase, runtime status, task summary, worker health.
- Resume command re-attaches/re-hydrates from persisted state and returns actionable errors when impossible.
- Shutdown command supports graceful + force mode and updates state coherently.

### Verification commands

```bash
npm run typecheck
npm run test:integration
npm run omg -- team run --task "phase1-smoke" --dry-run --json
```

---

## Phase 2 — Worker Protocol + Runtime Wiring (P0/P1)

### Scope

- Standardize worker bootstrap/inbox protocol for OmG runtime workers.
- Require claim-before-work.
- Require structured completion evidence in task results.
- Wire tmux worker dispatch to task lifecycle APIs.

### Candidate file areas

- `src/team/runtime/tmux-backend.ts`
- new worker bootstrap/protocol helper files under `src/team/`
- `docs/testing/live-team-e2e.md`

### Acceptance criteria

- Worker startup includes ACK and identity resolution.
- Worker cannot mark task in progress without claim token.
- Failed dispatch releases claim automatically.
- Monitor snapshot and task files remain consistent under restart/retry.

### Verification commands

```bash
npm run typecheck
npm run test:reliability
npm run test:integration
npm run team:e2e -- "omg worker protocol smoke"
```

---

## Phase 3 — Role/Skill Contract and Extension Surface (P1)

### Scope

- Define role input/output/evidence contract.
- Expand extension skills beyond `plan` with minimal core set:
  - `execute`, `review`, `verify`, `handoff` (plus lifecycle-oriented team skill if needed).
- Map role IDs to skill workflows and artifact schema.

### Candidate file areas

- `skills/*`
- `commands/omg/team/*`
- new docs under `docs/architecture/` for role/skill contracts

### Acceptance criteria

- Each core role produces required artifacts with stable schema.
- Role routing from task tags + explicit flags remains deterministic.
- Unknown/invalid role assignments fail fast with actionable diagnostics.

### Verification commands

```bash
npm run typecheck
npm run test
npm run verify -- --json
```

---

## Phase 4 — Reliability Hardening + Rollout Completion (P1/P2)

### Scope

- Tighten durability options for orchestration-critical writes.
- Expand monitor reason taxonomy and operator diagnostics.
- Remove/lock down legacy compatibility bypasses after migration window.

### Acceptance criteria

- No false-green completion under injected fault scenarios.
- Watchdog/non-reporting/dead-worker paths produce deterministic reason codes.
- Legacy bypasses are auditable and disabled by default in release gates.

### Verification commands

```bash
npm run test:reliability
npm run test:all
npm run gate:publish
```

---

## 3) CI/Test Gate Additions (Required)

## New gate: Team Control Plane Contract (blocking)

Suggested script alias:

- `npm run gate:team-control-plane`

Must include:

1. claim conflict handling,
2. lease expiry handling,
3. invalid transition rejection,
4. blocked dependency protection,
5. claim release rollback behavior.

## Existing gate integration

- Add `gate:team-control-plane` into `gate:3` before publish.

---

## 4) Backward Compatibility Commitments

1. Existing `omg team run` contract remains valid.
2. Existing `.omg/state` paths remain canonical.
3. Subagents remain explicitly opt-in until Phase 4 sign-off.
4. Legacy toggles remain temporary and explicitly warned/audited during migration.

---

## 5) Completion Definition (Program-level DoD)

Program is done when all are true:

- Control-plane APIs are landed and gate-covered.
- Lifecycle CLI verbs are stable and documented.
- Worker protocol is enforced in runtime and validated in live e2e evidence.
- Role/skill contracts are implemented for minimal core role set.
- CI blocking gates include team-control-plane reliability checks.

