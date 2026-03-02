# OmG-Native Acceptance Criteria and CI Gate Expansion

Date: 2026-03-02  
Purpose: define acceptance criteria and test/CI gates required to land OmG-native orchestration + role/skill adoption safely.

---

## 1) Baseline to Preserve

Existing blocking baseline must remain intact:

- C0: global install contract
- C1: typecheck/build/smoke/integration/reliability/verify
- C2: publish gate with pre-release blocking

Reference sources:

- `docs/testing/gates.md`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

---

## 2) New Acceptance Domains

## Domain A — Lifecycle command correctness

Applies to:

- `team status`
- `team resume`
- `team shutdown`

### Must-pass acceptance criteria

1. valid invocation returns deterministic output (JSON + text mode)
2. invalid invocation fails with usage exit code (`2`)
3. runtime failure exits `1` with actionable reason
4. status output includes phase + tasks + worker health summary
5. resume and shutdown behave correctly when team does not exist

## Domain B — Task lifecycle mutation safety

Applies to claim/transition/release flow.

### Must-pass acceptance criteria

1. only legal transitions are allowed
2. claim conflicts are deterministic
3. stale lease behavior is deterministic and tested
4. version mismatch/CAS mismatch is explicit
5. no direct status overwrite path bypasses lifecycle APIs in new code

## Domain C — Role contract integrity

Applies to planner/executor/verifier roles.

### Must-pass acceptance criteria

1. required output fields exist per role
2. artifact location is deterministic and discoverable
3. verifier role can fail run based on evidence mismatch
4. role-tag parsing and explicit role selection stay contract-consistent

## Domain D — Docs/UX alignment

### Must-pass acceptance criteria

1. `README.md`, `docs/omg/commands.md`, extension command prompts, and CLI help agree on syntax
2. no stale examples for removed/renamed flags
3. runbook reflects actual status/resume/shutdown behavior

---

## 3) Proposed Gate Additions

## Gate R1 — Lifecycle CLI Gate (blocking once Phase 2 begins)

### Commands

```bash
npm run typecheck
npm run test:reliability -- team-lifecycle
npm run test:integration -- team-lifecycle
npm run omg -- team run --task "lifecycle gate smoke" --dry-run --json
```

### Pass conditions

- lifecycle command tests green
- no regression on existing `team run` contracts

## Gate R2 — Control-Plane Mutation Gate (blocking once Phase 1 lands)

### Commands

```bash
npm run test:reliability -- task-lifecycle
npm run test:reliability -- team-state-store
```

### Pass conditions

- conflict/lease/CAS failure paths are deterministic
- illegal transitions fail fast and are assertion-covered

## Gate R3 — Role Contract Gate (blocking once Phase 3 lands)

### Commands

```bash
npm run test:reliability -- subagents
npm run test:integration -- subagents-team-run
npm run omg -- team run --backend subagents --task "$planner /executor /verifier role contract gate" --dry-run --json
```

### Pass conditions

- role contracts validate required artifacts
- parser/selection/assignment mismatch paths stay deterministic

## Gate R4 — Docs Contract Gate (non-blocking at first, later blocking)

### Commands

```bash
npm run typecheck
npm run verify -- --dry-run --json
```

Plus scripted doc contract checks (to be added) for:

- command strings in docs
- extension prompt command examples

### Pass conditions

- no documented command drift
- no removed command examples left in docs

---

## 4) CI Workflow Integration Plan

## Step 1 (early)

- keep existing jobs unchanged
- add new targeted reliability tests inside existing `test:reliability`

## Step 2 (mid)

- add dedicated lifecycle/control-plane job in `ci.yml` (blocking)
- keep optional signals job for live/operator smoke

## Step 3 (late)

- make docs contract check blocking
- add role-contract dry-run checks to release pre-blocking job

---

## 5) Exit Criteria by Phase

| Phase | Gate Evidence Required |
|---|---|
| Phase 1 | R2 green + existing C1 still green |
| Phase 2 | R1 green + integration lifecycle tests |
| Phase 3 | R3 green + role artifact checks |
| Phase 4 | extension/skill docs contract checks green |
| Phase 5 | full C0/C1/C2 + R1/R2/R3/R4 all green |

---

## 6) Minimal Evidence Format for PRs

Every adoption PR should include:

1. changed contracts summary (what behavior changed),
2. test commands run + exit codes,
3. files proving state/schema compatibility,
4. rollback note for the changed area.

Recommended template:

```text
Verification:
- PASS: <command> (exit=0)
- PASS: <command> (exit=0)
- FAIL: <command> (exit=1) [if any, include follow-up]

Compatibility:
- Legacy behavior preserved for: <list>
- New behavior gated by: <flag/test/job>
```
