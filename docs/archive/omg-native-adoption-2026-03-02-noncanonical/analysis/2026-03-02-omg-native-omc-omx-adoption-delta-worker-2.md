<!-- markdownlint-disable MD013 MD024 MD060 -->

# OmG-native Adoption Delta: OmC/OmX Team Orchestration + Role/Skill Capabilities (Worker 2)

Date: 2026-03-02  
Author: worker-2  
Scope: `oh-my-gemini` repository baseline + existing OmC/OmX comparison artifacts

---

## 1) Objective

Define **what OmG should adopt from OmC/OmX**, what it should adapt for Gemini extension-first UX, and what should remain out of scope for now.

This document focuses on:

- concrete capability differences,
- architecture deltas needed in OmG,
- migration constraints that must not be violated.

---

## 2) Evidence baseline (OmG As-Is)

Primary code/docs reviewed:

- `src/cli/index.ts`
- `src/cli/commands/team-run.ts`
- `src/team/team-orchestrator.ts`
- `src/team/runtime/tmux-backend.ts`
- `src/team/runtime/subagents-backend.ts`
- `src/state/team-state-store.ts`
- `src/state/types.ts`
- `docs/architecture/runtime-backend.md`
- `docs/architecture/state-schema.md`
- `docs/testing/gates.md`
- `docs/testing/live-team-e2e.md`
- `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Existing comparison docs:
  - `docs/analysis/omc-omx-omg-adversarial-comparison.md`
  - `docs/analysis/omc-omx-team-orchestration-role-skill-todo.md`

---

## 3) Concrete difference matrix (OmC/OmX vs OmG)

## 3.1 Team control-plane depth

| Capability | OmC/OmX pattern | OmG current | Delta type |
|---|---|---|---|
| Team lifecycle control commands | Rich operational surface (`status/resume/shutdown`) | `omg team run` only | **Missing** |
| Task lifecycle API | Claim/lease/transition/release semantics in active use | Store has CAS-capable task writes but no first-class CLI/API surface | **Partial** |
| Mailbox semantics | notified/delivered workflows used operationally | NDJSON mailbox exists; orchestration-level protocol not fully surfaced | **Partial** |
| Worker protocol enforcement | Explicit worker ACK → claim → work → completion | Contract exists in docs/tests but not yet OmG-native runtime policy | **Partial** |

## 3.2 Runtime behavior

| Capability | OmC/OmX pattern | OmG current | Delta type |
|---|---|---|---|
| tmux backend maturity | Full team operations controller | Strong start/monitor/shutdown baseline | **Near parity (core)** |
| Subagent backend semantics | Role assignment tied to real workflow/data-plane behavior | Deterministic completed snapshot (simulated completion profile) | **Major gap** |
| Recovery operations | Runtime resume + controlled shutdown paths | Orchestrator fix-loop exists; explicit resume/status CLI not present | **Missing/partial** |

## 3.3 Role/skill surface

| Capability | OmC/OmX pattern | OmG current | Delta type |
|---|---|---|---|
| Role catalog breadth | Broad role sets + workflow utility modes | Role catalog present (21 blueprint roles) | **Good baseline** |
| Skill execution surface | Many reusable skills/modes | Extension-level skill mostly `plan` | **Major gap** |
| Role→output contract | Operationally explicit in workflows | No canonical OmG role output schema yet | **Missing** |

## 3.4 Verification and release discipline

| Capability | OmC/OmX pattern | OmG current | Delta type |
|---|---|---|---|
| CI blocking gates | Varies | Strong C0/C1/C2-style blocking gates already present | **OmG strength** |
| Reliability hardening suite | Varies by repo | Dedicated reliability suite with dead/non-reporting/watchdog coverage | **OmG strength** |
| Consumer install contract | Varies | Explicit global install contract + publish gate | **OmG strength** |

**Key conclusion:** OmG already has strong packaging/gates and a clean runtime abstraction, but still lacks OmX-class control-plane operations and OmC-class role/skill UX breadth.

---

## 4) OmG-native adoption principles (do not copy blindly)

1. **Keep extension-first UX as the primary entrypoint.**
2. **Keep tmux as default backend.** Subagents remain explicit opt-in until parity.
3. **Promote state-store contracts into user-visible operations**, instead of introducing parallel ad-hoc file mutation paths.
4. **Adopt OmX control-plane rigor, not OmX command sprawl.**
5. **Adopt OmC role/skill discoverability, but keep minimal, high-signal first wave.**

---

## 5) Required architecture deltas for OmG

## Delta A — Add Team Control Plane layer (new internal module)

Create a first-class control-plane service over `TeamStateStore`:

- `claimTask(taskId, worker, expectedVersion?)`
- `transitionTask(taskId, from, to, claimToken)`
- `releaseClaim(taskId, claimToken)`
- `sendMailboxMessage(...)`
- `markMailboxDelivered/notified(...)`

**Why:** OmG already has durable state primitives; this makes lifecycle operations explicit and auditable.

## Delta B — Expand CLI lifecycle commands

Add `omg team` operational subcommands:

- `status --team <name>`
- `shutdown --team <name> [--force]`
- `resume --team <name>`

**Why:** closes operator gap with OmC/OmX while preserving OmG command philosophy.

## Delta C — Worker protocol hardening (runtime-verified)

Standard worker sequence must be enforceable:

1. ACK mailbox write
2. task claim before work
3. completion write with structured verification evidence
4. status reset to idle

**Why:** prevents silent work without ownership and improves forensic quality.

## Delta D — Role→Skill contract schema (new architecture contract)

Define canonical per-role outputs (JSON + markdown evidence) for first wave roles:

- planner
- executor
- verifier
- reviewer/critic

**Why:** role selection without output contract is not operational orchestration.

## Delta E — Subagents backend realism upgrade

Move from deterministic completed snapshots to staged runtime semantics:

- assignment execution evidence,
- intermediate state updates,
- role artifact paths in snapshot metadata.

## Delta F — Legacy compatibility governance

Treat `OMG_LEGACY_RUNNING_SUCCESS` and `OMG_LEGACY_VERIFY_GATE_PASS` as temporary migration toggles with:

- explicit event logging,
- CI guardrails preventing release with flags enabled in baseline flows,
- scheduled removal criteria.

## Delta G — Unified observability envelope

Ensure monitor snapshot includes:

- role assignment map,
- claim/transition outcomes,
- retry/fix reason taxonomy,
- verification evidence links.

---

## 6) Migration constraints (hard constraints)

1. **State compatibility:** continue reading legacy phase/task/mailbox payloads while writing canonical forms.
2. **Command compatibility:** do not break existing `setup/doctor/team run/verify` contracts.
3. **Default behavior stability:** keep `tmux` default + `workers 1..8` + `max-fix-loop <= 3`.
4. **No generated-artifact edits:** maintain source-of-truth in `src/` + docs.
5. **Feature-flag rollout for risky deltas:** subagent realism and strict protocol enforcement should begin opt-in.
6. **Cross-platform shell safety:** avoid assumptions that only hold in one shell/CI environment.
7. **Evidence-first migration:** each phase lands only with reliability test coverage + CI gate alignment.

---

## 7) What OmG should NOT adopt now

- OmC/OmX full command breadth in one shot.
- Per-subagent model divergence (keep unified model policy for now).
- UI/dashboard scope expansion before control-plane parity.
- New orchestration paths that bypass `TeamStateStore` contracts.

---

## 8) ADR candidates (recommended)

1. **ADR: Team control-plane canonical API (state mutation ownership).**
2. **ADR: Worker protocol contract and compliance signals.**
3. **ADR: Role/skill output schema v1.**
4. **ADR: Legacy compatibility flag lifecycle policy.**
5. **ADR: Subagents realism graduation criteria (experimental → supported).**

---

## 9) Bottom line

OmG should adopt:

- **OmX-style control-plane rigor** (task/mailbox/worker lifecycle semantics), and
- **OmC-style role/skill usability** (discoverable and reusable role workflows),

while preserving OmG’s strongest differentiators:

- extension-first product surface,
- tmux-default operational reliability,
- strict CI/release gate discipline.
