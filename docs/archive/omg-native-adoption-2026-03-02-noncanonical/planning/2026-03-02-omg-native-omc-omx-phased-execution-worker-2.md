<!-- markdownlint-disable MD013 MD024 MD060 -->

# OmG-native Adoption Plan: Phased Execution, Gates, Risks, Rollout (Worker 2)

Date: 2026-03-02  
Author: worker-2

Related analysis:

- `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md`
- `docs/analysis/omc-omx-omg-adversarial-comparison.md`

---

## 1) Planning goal

Deliver OmC/OmX-grade orchestration rigor in OmG **without sacrificing extension-first UX and tmux-default reliability**.

---

## 2) Phased execution plan

## Phase 0 — Contract freeze and design lock (short)

### Scope

- Freeze OmG-native adoption boundaries and non-goals.
- Approve control-plane API shape and worker protocol requirements.

### Deliverables

- ADR drafts for control-plane, worker protocol, role output schema.
- Finalized capability gap matrix and adoption decisions.

### Acceptance criteria

- A single approved capability matrix exists (adopt/adapt/defer).
- No unresolved blocker on task lifecycle ownership model.

---

## Phase 1 — Control-plane foundation (P0)

### Scope

Build first-class control-plane operations over `TeamStateStore`.

### Candidate implementation surface

- new module(s) under `src/team/` (control-plane service)
- `src/state/team-state-store.ts` (add missing helper operations if needed)
- new reliability tests for claim/transition/release semantics

### Required capabilities

- claim token issuance + lease validation
- atomic status transition API with claim token validation
- mailbox delivery/notified mutation semantics

### Acceptance criteria

- task lifecycle cannot be advanced without valid claim token
- CAS mismatch and lease-expired paths are deterministic and tested
- all state writes remain canonical (`task-<id>.json`, mailbox `.ndjson`)

---

## Phase 2 — Operational lifecycle CLI parity (P0/P1)

### Scope

Add operator commands and recovery controls.

### Candidate command surface

- `omg team status --team <name> [--json]`
- `omg team shutdown --team <name> [--force] [--json]`
- `omg team resume --team <name> [--json]`

### Acceptance criteria

- status reads phase + monitor + task summaries from canonical state
- shutdown consistently tears down runtime handle and writes terminal evidence
- resume path is deterministic when prior run is recoverable

---

## Phase 3 — Role/skill contract and subagent realism (P1)

### Scope

Upgrade role/skill orchestration from selection-only to evidence-backed execution contracts.

### Required capabilities

- role output schema v1 (`planner/executor/verifier/reviewer`)
- role artifacts referenced in team snapshot/runtime metadata
- extension skill expansion beyond plan-only baseline
- subagents runtime emits staged progress/evidence instead of immediate deterministic completion

### Acceptance criteria

- each selected role produces required output fields and evidence pointers
- run snapshot contains role-to-worker assignment + artifact references
- unknown/malformed role output fails verify gate deterministically

---

## Phase 4 — Legacy flag governance + hardening (P1/P2)

### Scope

Reduce false-green risk from temporary compatibility toggles.

### Required capabilities

- explicit event logging when legacy flags are active
- CI check that baseline gates run with legacy flags disabled
- migration notes + deprecation timeline

### Acceptance criteria

- release gates fail when baseline workflows rely on legacy bypass behavior
- compatibility flags documented as temporary and observable in state/events

---

## Phase 5 — Rollout and graduation (P2)

### Scope

Progressively roll out new control-plane + role/skill behavior.

### Required capabilities

- ringed release strategy
- rollback switches and documented operator runbooks
- live e2e evidence collection at each ring

### Acceptance criteria

- each rollout ring has explicit entry/exit metrics
- rollback command paths are tested and documented

---

## 3) Test and CI gate updates (proposed)

## 3.1 Existing gates to preserve

- C0 consumer/global install contract
- C1 quality (typecheck/build/smoke/integration/reliability/verify)
- C2 publish pre-release blocking

## 3.2 New gate focus for adoption work

| Gate | Purpose | Minimum checks |
|---|---|---|
| C3-control-plane | enforce lifecycle mutation rigor | claim/transition/lease tests + negative-path reliability coverage |
| C4-role-contract | enforce role output schema | role output validation tests + snapshot evidence assertions |
| C5-operator-lifecycle | enforce operational parity | `team status/resume/shutdown` integration tests + live e2e evidence |

## 3.3 Proposed command bundle (developer verification)

```bash
npm run typecheck
npm run test:reliability
npm run test:integration
npm run verify -- --json
npm run team:e2e -- "omg-native-adoption-smoke"
```

---

## 4) Risk register

| ID | Risk | Probability | Impact | Mitigation | Trigger |
|---|---|---:|---:|---|---|
| R1 | Control-plane APIs diverge from state contract | Medium | High | API-first ADR + contract tests before CLI exposure | repeated CAS/claim bugs |
| R2 | Subagents remain pseudo-runtime and create false confidence | High | High | staged runtime evidence requirements + verify-gate assertions | snapshots show completed without artifacts |
| R3 | Legacy flags mask regressions | Medium | High | CI ban for baseline with legacy flags + explicit runtime logging | green verify with missing verifyBaseline signal |
| R4 | Role/skill expansion adds surface without consistency | Medium | Medium | role schema v1 + limited first-wave roles only | inconsistent output formats |
| R5 | Operator commands introduce runtime cleanup regressions | Medium | Medium | lifecycle integration tests + forced-shutdown fallback | stale team sessions/state left behind |
| R6 | Docs drift from command behavior | Medium | Medium | docs check in C1/C5 + command help snapshot tests | user reports mismatched flags/examples |

---

## 5) Rollout strategy (ringed)

## Ring 0 — Internal dev-only (opt-in)

- feature flags on
- goal: stabilize APIs and failure semantics
- exit metric: reliability suite green + no data-loss defect

## Ring 1 — Maintainer canary

- selected maintainers run new lifecycle commands in real tmux sessions
- capture live evidence (`status`, `shutdown`, `resume`) + rollback checks
- exit metric: 3 consecutive green canary cycles

## Ring 2 — Default for tmux control-plane paths

- enable control-plane/lifecycle commands by default
- keep advanced role-contract strictness as opt-in warning mode first
- exit metric: no critical regressions across one release cycle

## Ring 3 — Full enforcement + deprecation

- enforce role-contract validation by default
- deprecate legacy compatibility bypasses per policy
- exit metric: release gates pass without legacy toggles

---

## 6) Decomposition readiness notes

This plan is intentionally aligned for `/ralph` decomposition by:

- explicit phase boundaries,
- measurable acceptance criteria,
- gate-linked verification commands,
- rollback-aware rollout rings.

Use the companion master synthesis doc for task-level dependency graph and execution-ready work packages.
