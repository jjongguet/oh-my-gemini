# OmG-native Final Canonical Set (04/07): Phased Execution Plan

Date: 2026-03-02  
Status: **Authoritative implementation sequence**
Depends on: FC2, FC3

## 1) Canonical phase model

| Phase | Name | Goal |
|---|---|---|
| 0 | Design lock | Freeze decisions, contracts, and gate model |
| 1 | Control-plane foundation | Land claim/transition/release + dependency safety |
| 2 | Lifecycle CLI parity | Add `status/resume/shutdown` on top of control-plane truth |
| 3 | Worker protocol hardening | Enforce ACK/claim/result/idle in tmux runtime |
| 4 | Role/skill contract realization | Implement role->skill->artifact contract and subagents truthfulness |
| 5 | Reliability, rollout, deprecation | Gate expansion, rollout, rollback, legacy cleanup |

**No phase skipping.** A later phase cannot be considered complete if the previous phase gates are red.

---

## 2) Phase details

## Phase 0 — Design lock

**Deliverables**
- canonical docs FC1–FC7 approved
- control-plane error taxonomy agreed
- task transition rules frozen

**Primary files**
- `docs/analysis/*`
- `docs/planning/*`

**Exit criteria**
- no unresolved contradictions in phase model, role baseline, or gate names

---

## Phase 1 — Control-plane foundation

**Deliverables**
- claim API
- transition API
- release API
- dependency readiness checks
- state schema updates

**Primary files**
- `src/team/*`
- `src/state/team-state-store.ts`
- `src/state/types.ts`
- `docs/architecture/state-schema.md`

**Exit criteria**
- deterministic claim conflict handling
- deterministic illegal transition rejection
- stale lease path covered by tests

**Required verification**
```bash
npm run typecheck
npm run test:reliability
```

---

## Phase 2 — Lifecycle CLI parity

**Deliverables**
- `omg team status`
- `omg team resume`
- `omg team shutdown`
- updated CLI help/docs/extension prompts

**Primary files**
- `src/cli/index.ts`
- `src/cli/commands/team-*.ts`
- `src/team/team-orchestrator.ts`
- `docs/omg/commands.md`
- `extensions/oh-my-gemini/commands/team/*.toml`

**Exit criteria**
- human + JSON output contract exists
- `team run` remains backward compatible
- shutdown/resume error paths are actionable

**Required verification**
```bash
npm run typecheck
npm run test:integration
npm run omg -- team run --task "phase2-smoke" --dry-run --json
```

---

## Phase 3 — Worker protocol hardening

**Deliverables**
- generated/standardized worker bootstrap protocol
- claim-before-work enforcement in tmux runtime
- structured completion evidence writes

**Primary files**
- `src/team/runtime/tmux-backend.ts`
- `src/team/team-orchestrator.ts`
- worker prompt/template surfaces
- `docs/testing/live-team-e2e.md`

**Exit criteria**
- worker ACK visible in mailbox
- unclaimed execution is rejected
- runtime + task state stay consistent across retries/restarts

**Required verification**
```bash
npm run typecheck
npm run test:integration
npm run test:reliability
npm run team:e2e
```

---

## Phase 4 — Role/skill contract realization

**Deliverables**
- baseline roles: planner/executor/verifier
- baseline skills: plan/execute/review/verify/handoff
- deterministic artifact schema and storage paths
- subagents truthfulness checks

**Primary files**
- `src/team/subagents-*.ts`
- `extensions/oh-my-gemini/skills/*`
- new/updated architecture docs for role contracts

**Exit criteria**
- invalid role assignment fails fast
- role outputs are schema-valid
- subagents completion requires artifact evidence

**Required verification**
```bash
npm run typecheck
npm run test
npm run verify -- --json
```

---

## Phase 5 — Reliability, rollout, deprecation

**Deliverables**
- gate expansion wired into CI/release
- rollout flags and rollback plan
- legacy bypass governance
- canonical docs replace draft references in runbooks

**Primary files**
- `tests/reliability/*`
- `.github/workflows/*.yml`
- `docs/testing/gates.md`
- release/runbook docs

**Exit criteria**
- adoption gates green
- rollout ring criteria defined and validated
- legacy bypasses blocked for release baseline

**Required verification**
```bash
npm run typecheck
npm run test
npm run verify
npm run gate:publish
```

---

## 3) Dependency model

- Phase 1 blocks Phase 2–5
- Phase 2 blocks Phase 3 and Phase 5 release readiness
- Phase 3 blocks Phase 4 and Phase 5 release readiness
- Phase 4 blocks final GA rollout in Phase 5

---

## 4) Implementation policy

1. Shared-file changes must be dependency-ordered.
2. Docs/CLI/help/examples must ship in the same phase as behavior changes.
3. Every phase must leave the repo in a releasable state.
4. No default-on behavior change without matching gate coverage.

