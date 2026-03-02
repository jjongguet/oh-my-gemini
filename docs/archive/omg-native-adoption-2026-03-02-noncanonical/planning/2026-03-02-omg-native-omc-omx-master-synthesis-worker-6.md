# Master synthesis (Worker 6): OmG-native adoption of OmC/OmX orchestration + role/skill capabilities

Date: 2026-03-02  
Author: worker-6  
Status: synthesis draft for lead integration

Related analysis:

- `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-analysis-worker-6.md`
- Existing peer analysis/planning artifacts under `docs/analysis/*worker-2*`, `docs/analysis/*worker-5*`, `docs/planning/*worker-2*`, `docs/planning/*worker-5*`

---

## 0) Executive synthesis

OmG should execute an **adopt-and-adapt** strategy:

1. **Adopt OmX control-plane rigor** (claim/lease/transition/messaging lifecycle).
2. **Adapt OmC staged role/skill discipline** into OmG’s extension-first surface.
3. **Preserve OmG differentiators**: tmux-default runtime, typed architecture, strong C0/C1/C2 release discipline.

Success condition: OmG can run/monitor/recover team workflows with evidence-backed completion semantics, without relying on OmX command fallbacks.

---

## 1) Final decision matrix

| Domain | Decision | Rationale |
|---|---|---|
| Team lifecycle commands | **Add now** (`status/resume/shutdown`) | Largest operator usability parity gap |
| Control-plane mutation APIs | **Add now** as canonical path | Prevent direct-write drift, enable strict invariants |
| Worker protocol enforcement | **Add now** with compatibility phase | Raise reliability without sudden breakage |
| Role output schema | **Add now** for first-wave roles | Make role routing operationally meaningful |
| Subagent realism | **Add in phased rollout** (opt-in first) | High impact but higher regression risk |
| Legacy compatibility toggles | **Deprecate with gates** | Reduce false-green completion risk |
| Full command/skill breadth parity | **Defer** | Avoid surface sprawl before core parity |

---

## 2) Target architecture (OmG-native)

```text
CLI + Extension command prompts
  -> Team Control Plane (new)
      - task claim/lease/transition/release
      - mailbox send/notified/delivered
      - worker protocol guardrails
  -> Team Orchestrator (existing, strengthened)
      - plan/exec/verify/fix/completed|failed
      - success checklist + health integration
  -> Runtime backends
      - tmux (default, production path)
      - subagents (experimental, staged graduation)
  -> TeamStateStore (existing)
      - canonical writes + compatibility reads
  -> Verify/CI gate layer
      - C0/C1/C2 existing + C3/C4/C5 additions
```

Key architectural rule: **all lifecycle mutations become control-plane API mediated**, not ad-hoc file edits.

---

## 3) Migration constraints (non-negotiable)

1. No breaking change to `setup`, `doctor`, `team run`, `verify` UX.
2. Default runtime posture unchanged (`tmux`, workers `1..8`, fix-loop cap `<=3`).
3. Legacy state formats remain read-compatible during migration window.
4. Canonical write paths remain stable (`tasks/task-<id>.json`, `mailbox/<worker>.ndjson`).
5. Risky behavior shifts ship behind feature flags first.
6. Docs/help/extension prompts/CI gates must move together in same wave.

---

## 4) Phased execution plan with acceptance criteria

## Phase 0 — Decision lock + ADR freeze

### Deliverables

- ADR: control-plane ownership and mutation invariants.
- ADR: worker protocol contract.
- ADR: role output schema v1.

### Acceptance criteria

- Adopt/adapt/defer matrix approved.
- No unresolved ownership ambiguity for task/mailbox mutations.

---

## Phase 1 — Control-plane foundation (P0)

### Deliverables

- New control-plane module and typed interfaces.
- Claim/lease/transition/release semantics.
- Mailbox lifecycle semantics (`send/list/mark_notified/mark_delivered`).

### Acceptance criteria

- Invalid claim token transition fails deterministically.
- Lease/CAS conflict paths covered by reliability tests.
- No lifecycle mutation path bypasses control-plane APIs.

---

## Phase 2 — Lifecycle operator commands (P0/P1)

### Deliverables

- `omg team status`
- `omg team resume`
- `omg team shutdown`

### Acceptance criteria

- `status` reflects merged truth (phase + monitor + task health).
- `shutdown` records graceful/force outcome and cleanup evidence.
- `resume` handles recoverable state deterministically.

---

## Phase 3 — Role/skill contracts + subagent realism (P1)

### Deliverables

- Role output schema v1 (`planner`, `executor`, `verifier`, `reviewer`).
- Extension skill expansion (minimum: `team`, `review`, `verify`, `handoff`).
- Subagent runtime emits staged evidence, not immediate synthetic completion only.

### Acceptance criteria

- Missing required role outputs fail verify.
- Snapshot metadata includes role assignment + artifact references.
- Subagent runs produce observable stage/evidence transitions.

---

## Phase 4 — Hardening + deprecation governance (P1/P2)

### Deliverables

- Legacy toggle audit logging and strict CI policy.
- OmG-native operator runbook replacing OmX fallback instructions.
- Failure taxonomy normalization for operator diagnostics.

### Acceptance criteria

- Release gate fails if baseline relies on legacy bypass flags.
- Live e2e evidence uses OmG-native lifecycle commands.
- Two consecutive release cycles pass without critical regression.

---

## 5) Test and CI gate model

## 5.1 Keep existing blocking gates

- **C0**: install contract (`gate:global-install-contract`)
- **C1**: quality baseline (typecheck/build/smoke/integration/reliability/verify)
- **C2**: publish gate (`gate:publish`)

## 5.2 Add adoption-specific gates

| Gate | Purpose | Required evidence |
|---|---|---|
| C3-control-plane | mutation correctness | claim/lease/transition negative-path reliability tests |
| C4-role-contract | role output integrity | schema validation tests + snapshot artifact assertions |
| C5-operator-lifecycle | runtime operations parity | lifecycle command integration tests + live e2e evidence |

## 5.3 Command evidence bundle (minimum)

```bash
npm run typecheck
npm run lint
npm run test
npm run test:reliability
npm run verify -- --json
```

When lifecycle commands land:

```bash
npm run omg -- team status --team <team> --json
npm run omg -- team resume --team <team> --json
npm run omg -- team shutdown --team <team> --force --json
```

---

## 6) Risk register

| ID | Risk | P | I | Score | Trigger | Mitigation |
|---|---|---:|---:|---:|---|---|
| R1 | Control-plane/state divergence | 3 | 5 | 15 | task state changes without claim trail | single mutation API + invariant tests |
| R2 | Direct write bypass persists | 4 | 5 | 20 | lifecycle changes appear without control-plane metadata | block direct writes in strict mode, CI enforcement |
| R3 | Legacy flags hide failures | 3 | 5 | 15 | verify passes with missing gate signals | log + gate + deprecation schedule |
| R4 | `status` output drifts from actual runtime | 3 | 5 | 15 | operator sees healthy state while workers dead/non-reporting | merged health truth model + snapshot consistency tests |
| R5 | Subagents remain synthetic and misleading | 3 | 4 | 12 | completed snapshots lack role evidence | staged subagent contract + verify coupling |
| R6 | Role catalog and skill surface drift | 4 | 4 | 16 | role exists but no execution contract | generated role/skill mapping checks in CI |
| R7 | Lifecycle command regressions leak resources | 2 | 4 | 8 | stale sessions/state after shutdown | forced-cleanup fallback + integration/e2e tests |
| R8 | Docs/command drift | 3 | 3 | 9 | CLI help differs from docs/prompts | docs-contract tests + release checklist |

Priority focus order: **R2 -> R6 -> R1/R3/R4 -> R5 -> R7/R8**.

---

## 7) Rollout strategy (ring-based)

## Ring 0 — Internal feature-flag validation

- Enable control-plane strictness and new lifecycle commands behind flags.
- Exit: reliability + integration green, no data-loss/state corruption defects.

## Ring 1 — Maintainer canary

- Daily real tmux team runs using new lifecycle commands.
- Exit: 3 consecutive green canary cycles with clean shutdown evidence.

## Ring 2 — Default lifecycle command availability

- `status/resume/shutdown` enabled by default.
- Role-contract checks begin in warning mode.
- Exit: one release cycle without critical lifecycle regressions.

## Ring 3 — Strict enforcement

- Role-contract checks become blocking.
- Legacy compatibility toggles enter sunset path or removal.
- Exit: two consecutive release cycles green under strict defaults.

Rollback rule per ring: flag-off strict features, preserve compatibility readers, keep C0/C1/C2 baseline usable.

---

## 8) Ralplan-ready task decomposition

Task IDs are dependency-ordered and execution-ready.

| ID | Subject | Depends on | Primary outputs | DoD / verification |
|---|---|---|---|---|
| RP6-00 | Freeze ADRs + final scope | - | 3 ADR docs + adoption matrix | review signoff logged |
| RP6-01 | Implement control-plane module scaffold | RP6-00 | `src/team/control-plane/*` typed interfaces | typecheck + unit tests |
| RP6-02 | Implement claim/lease/transition/release semantics | RP6-01 | mutation APIs + error taxonomy | reliability tests for conflicts/invalid transitions |
| RP6-03 | Implement mailbox lifecycle APIs | RP6-01 | send/list/notified/delivered paths | reliability tests + state fixture checks |
| RP6-04 | Add `omg team status` command | RP6-02 | CLI command + docs/help | integration tests + JSON output assertions |
| RP6-05 | Add `omg team shutdown` command | RP6-02 | graceful/force shutdown flow | integration tests + cleanup evidence |
| RP6-06 | Add `omg team resume` command | RP6-02, RP6-05 | resumable run flow | integration + failure-path reliability tests |
| RP6-07 | Worker protocol compliance checks | RP6-02 | ACK/claim/complete/idle enforcement | protocol reliability tests |
| RP6-08 | Role output schema v1 | RP6-00 | schema + validator for core roles | schema tests + fixtures |
| RP6-09 | Extend extension skill surface | RP6-08 | `team/review/verify/handoff` skills | prompt/command contract checks |
| RP6-10 | Subagent staged evidence model | RP6-08 | runtime staged snapshots + artifacts | integration/reliability tests |
| RP6-11 | Legacy-toggle governance + telemetry | RP6-02 | audit logs + CI checks | gate tests proving no baseline bypass |
| RP6-12 | Gate expansion (C3/C4/C5) | RP6-04, RP6-08, RP6-10 | CI/workflow updates + gate docs | CI dry-run + local gate run evidence |
| RP6-13 | OmG-native live operator runbook/e2e | RP6-04, RP6-05, RP6-06 | updated runbook + scripts | live e2e evidence captured |
| RP6-14 | Rollout + rollback playbook finalization | RP6-12, RP6-13 | ring checklist + rollback procedure | maintainer approval + rehearsal logs |

Suggested waves:

- **Wave A**: RP6-00..RP6-03
- **Wave B**: RP6-04..RP6-07
- **Wave C**: RP6-08..RP6-10
- **Wave D**: RP6-11..RP6-14

---

## 9) Program-level definition of done

Adoption is complete when all are true:

1. OmG has first-class lifecycle operations (`run/status/resume/shutdown`).
2. Lifecycle mutations are control-plane mediated with strict invariants.
3. Core role workflows produce schema-validated evidence artifacts.
4. C3/C4/C5 gates are stable and protecting release quality.
5. OmG operator e2e no longer depends on OmX lifecycle command fallbacks.
