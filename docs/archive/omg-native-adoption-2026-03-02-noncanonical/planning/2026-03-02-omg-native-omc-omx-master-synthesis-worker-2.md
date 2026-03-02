<!-- markdownlint-disable MD013 MD024 MD060 -->

# Master Synthesis: OmG-native Adoption of OmC/OmX Orchestration + Role/Skill Capabilities (Worker 2)

Date: 2026-03-02  
Author: worker-2  
Status: Draft for lead synthesis

Companion docs:

- Analysis deltas: `docs/analysis/2026-03-02-omg-native-omc-omx-adoption-delta-worker-2.md`
- Phased plan: `docs/planning/2026-03-02-omg-native-omc-omx-phased-execution-worker-2.md`

---

## 0) Executive synthesis

OmG should converge on:

1. **OmX-grade control-plane rigor** (task claim/lease/transition/release + mailbox delivery semantics),
2. **OmC-grade role/skill usability** (discoverable, reusable, role-driven workflows),
3. while preserving OmG’s differentiators:
   - extension-first product entrypoint,
   - tmux-default runtime path,
   - strict CI/publish gate discipline.

This is an **adopt + adapt** strategy, not a direct feature clone.

---

## 1) Concrete differences and target decisions

## 1.1 Decision matrix (Adopt / Adapt / Defer)

| Area | OmG current | Target decision |
|---|---|---|
| Team lifecycle ops | `team run` only | **Adopt+adapt**: add `team status/resume/shutdown` in OmG style |
| Task lifecycle control-plane | store-level CAS exists, limited operational surface | **Adopt**: explicit claim/transition/release APIs as canonical mutation path |
| Worker protocol enforcement | conventions exist, not fully runtime-enforced | **Adopt**: ACK→claim→work→complete protocol with verify evidence |
| Subagent semantics | deterministic completed snapshot tendency | **Adapt**: staged evidence-backed execution semantics |
| Role catalog | good blueprint baseline | **Keep + operationalize** with role output schema |
| Extension skills | plan-heavy minimal set | **Adapt**: add minimal role-linked skills first (`team/review/verify/handoff`) |
| Legacy compatibility flags | available for migration | **Constrain**: temporary, auditable, CI-controlled |
| CI/release gating | strong baseline already | **Keep and extend** with control-plane/role-contract gates |

---

## 2) Architectural deltas (target-state)

## 2.1 Delta architecture

### A. New Team Control Plane service (internal)

Ownership:

- canonical mutations for task/mailbox/worker lifecycle
- lease/claim token validation
- transition guardrails

Suggested location:

- `src/team/control-plane/*` (or equivalent)

### B. CLI lifecycle expansion

Add operator-oriented subcommands under `omg team`:

- `status`
- `resume`
- `shutdown`

### C. Worker protocol contract enforcement

Runtime/verification should fail if worker bypasses required protocol:

- no ACK,
- no claim,
- missing completion evidence,
- missing idle status reset.

### D. Role/skill output schema v1

Define required outputs for first-wave roles:

- planner: decomposition + acceptance criteria
- executor: deliverables + changed paths + verification commands
- verifier: PASS/FAIL evidence + regression notes
- reviewer/critic: risk/quality findings + severity

### E. Subagents realism upgrade

Replace immediate-completed semantics with staged lifecycle evidence:

- per-role start/finish markers,
- artifact references,
- explicit verification baseline signal source.

---

## 3) Migration constraints (must hold)

1. **Backwards-read compatibility** for legacy phase/task/mailbox artifacts.
2. **No breaking change** to existing core commands (`setup`, `doctor`, `team run`, `verify`).
3. **Runtime policy invariants remain stable**:
   - default backend `tmux`,
   - workers `1..8` default `3`,
   - fix-loop cap `<=3`.
4. **State mutation single-writer discipline** remains intact.
5. **Feature-flag first rollout** for high-risk behavior shifts.
6. **CI gating before default enablement**.

---

## 4) Phased execution + acceptance criteria

## Phase 0 — Design lock

- Output: approved ADRs and adoption matrix
- Accept if: no unresolved ownership ambiguity for state/control-plane mutations

## Phase 1 — Control-plane foundation

- Output: claim/transition/release + mailbox semantics APIs
- Accept if:
  - invalid claim token transitions fail deterministically,
  - CAS/lease tests pass,
  - canonical state artifacts are preserved.

## Phase 2 — Team lifecycle operations

- Output: `team status/resume/shutdown`
- Accept if:
  - status output matches persisted phase/monitor/task truth,
  - shutdown always attempts cleanup and records result,
  - resume path deterministic under recoverable state.

## Phase 3 — Role/skill contract v1 + subagent realism

- Output: role output schema and evidence-backed subagent lifecycle
- Accept if:
  - selected roles produce required schema artifacts,
  - verify fails on missing role evidence,
  - snapshots include role assignment + artifact pointers.

## Phase 4 — Hardening + legacy governance

- Output: strict compatibility governance, docs/runbooks, CI guardrails
- Accept if:
  - baseline gates pass with legacy toggles off,
  - legacy toggle usage is explicitly observable in state/events.

## Phase 5 — Rollout + graduation

- Output: ringed rollout completion and default policy graduation
- Accept if:
  - ring exit criteria achieved,
  - rollback evidence validated,
  - no critical reliability regressions.

---

## 5) Test / CI gate model (proposed extension)

## Existing gate baseline to keep

- C0 install contract
- C1 quality gate
- C2 publish gate

## Additions for adoption program

| Gate | Adds what | Example checks |
|---|---|---|
| C3 Control-plane contract | lifecycle mutation correctness | new reliability tests for claim/lease/transition/mutation ownership |
| C4 Role contract | role output validity | role-schema validation tests + integration snapshot assertions |
| C5 Operator lifecycle | runtime operations parity | lifecycle integration for `status/resume/shutdown` + live e2e script evidence |

Recommended blocking order:

1. C0
2. C1
3. C3/C4
4. C5 (blocking for release branch; optional signal for regular PR initially)

---

## 6) Risk register (synthesis)

| Risk | Severity | Mitigation | Owner profile |
|---|---|---|---|
| Incomplete control-plane semantics cause state drift | High | API-first + contract tests before CLI exposure | architect + test-engineer |
| Subagent realism remains simulated | High | mandatory role artifacts + staged runtime markers | runtime owner |
| Compatibility flags mask failures | High | CI guard + explicit event logging + deprecation schedule | maintainer |
| Role/skill expansion outpaces consistency | Medium | first-wave role schema only; defer long tail | product/architecture |
| Ops command regressions leave stale resources | Medium | integration + forced shutdown path tests | runtime owner |
| Docs/CLI drift | Medium | command/help/doc sync checks in CI | docs owner |

---

## 7) Rollout strategy

## Ring 0 (internal opt-in)

- enable behind flags
- collect failure taxonomy data

## Ring 1 (maintainer canary)

- run real tmux team tasks with lifecycle commands
- validate cleanup + recovery behavior

## Ring 2 (default lifecycle ops enabled)

- `status/shutdown/resume` default supported
- role-contract checks in warning mode

## Ring 3 (full enforcement)

- role-contract checks become strict by default
- legacy toggles deprecation path activated

Rollback principle for every ring:

- disable new strict mode via feature flag,
- retain state compatibility readers,
- preserve C0/C1 baseline operability.

---

## 8) Ralplan-ready task decomposition (execution package)

Task IDs are dependency-aware and intentionally scoped for `/ralph` style execution.

| Task ID | Subject | Depends on | Primary outputs | Verification |
|---|---|---|---|---|
| RP-00 | Freeze adoption ADRs | - | ADR set + accepted matrix | docs review + approval record |
| RP-01 | Implement control-plane API skeleton | RP-00 | control-plane module + typed contracts | typecheck + new unit tests |
| RP-02 | Claim/lease/transition enforcement | RP-01 | guarded mutation paths + error taxonomy | reliability tests (CAS/lease/token) |
| RP-03 | Mailbox notified/delivered semantics | RP-01 | mailbox mutation helpers + contract docs | reliability tests + state fixture checks |
| RP-04 | Add `team status` command | RP-02 | CLI command + JSON/human outputs | integration tests + smoke CLI help |
| RP-05 | Add `team shutdown` command | RP-02 | graceful + force shutdown path | integration tests + live e2e evidence |
| RP-06 | Add `team resume` command | RP-02, RP-05 | resumable lifecycle path + guardrails | reliability + integration recovery tests |
| RP-07 | Worker protocol compliance checks | RP-02 | ACK/claim/complete/idle enforcement | reliability protocol tests |
| RP-08 | Role output schema v1 | RP-00 | schema docs + validators | schema tests + role fixture validation |
| RP-09 | Expand extension skills (minimal set) | RP-08 | `team/review/verify/handoff` skills | extension prompt checks + docs sync |
| RP-10 | Subagents realism upgrade | RP-08 | staged execution evidence in snapshots | subagents integration + reliability tests |
| RP-11 | Legacy flag governance + telemetry | RP-02 | event logging + CI guards | reliability + gate tests |
| RP-12 | CI gate extension (C3/C4/C5) | RP-04, RP-08, RP-10 | workflow updates + gate docs | CI dry-run + local script validation |
| RP-13 | Rollout ring runbooks + rollback | RP-12 | rollout docs + operator runbook | live e2e cycles + signoff checklist |

## Suggested wave bundling

- Wave A: RP-00..RP-03
- Wave B: RP-04..RP-07
- Wave C: RP-08..RP-10
- Wave D: RP-11..RP-13

---

## 9) Definition of done for this adoption program

Adoption is complete only when:

1. lifecycle operations are first-class in OmG (`run/status/resume/shutdown`),
2. state mutations flow through enforced control-plane semantics,
3. role/skill orchestration produces verifiable artifacts,
4. CI gates protect against false-green regressions,
5. rollout reaches default-safe state without legacy bypass dependency.
