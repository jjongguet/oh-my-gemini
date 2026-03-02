# OmG-native adoption analysis (Worker 6): OmC/OmX team orchestration + role/skill capabilities

Date: 2026-03-02  
Author: worker-6  
Scope: evidence-based capability deltas and target architecture decisions for `oh-my-gemini`

---

## 1) Objective

Define, in implementation terms, **how OmG should adopt OmC/OmX orchestration strengths** while preserving OmG’s identity:

- extension-first UX (`extensions/oh-my-gemini`),
- tmux-default runtime policy,
- typed/durable state and CI gate discipline.

---

## 2) Evidence baseline

### 2.1 OmG (current As-Is)

- CLI surface: `src/cli/index.ts`, `docs/omg/commands.md`
- Team run contract: `src/cli/commands/team-run.ts`
- Orchestrator lifecycle/checklist: `src/team/team-orchestrator.ts`
- Runtime backends: `src/team/runtime/{runtime-backend.ts,tmux-backend.ts,subagents-backend.ts}`
- State contract/store: `src/state/team-state-store.ts`, `docs/architecture/state-schema.md`
- Runtime policy/reliability: `docs/architecture/runtime-backend.md`, `src/team/monitor.ts`, `docs/testing/gates.md`
- Role inventory/catalog: `src/team/subagents-blueprint.ts`, `src/team/subagents-catalog.ts`, `.gemini/agents/catalog.json`
- Extension skill surface: `extensions/oh-my-gemini/skills/plan/SKILL.md`

### 2.2 OmX / OmC (comparison anchors)

- OmX operational surface + lifecycle commands: `.omx/tmp/oh-my-codex/README.md`
- OmX mutation contract: `.omx/tmp/oh-my-codex/docs/interop-team-mutation-contract.md`
- OmX team worker protocol: `.omx/tmp/oh-my-codex/skills/team/SKILL.md`
- OmC staged team pipeline model: `.omx/tmp/oh-my-claudecode/README.md`, `.omx/tmp/oh-my-claudecode/docs/CLAUDE.md`

---

## 3) OmG current-state invariants worth preserving

1. **Clear runtime abstraction** (`RuntimeBackend`) and deterministic team phase model (`plan -> exec -> verify -> fix -> completed|failed`).
2. **Strict worker-count / fix-loop contracts** (`workers 1..8`, default `3`, max fix-loop cap `3`).
3. **Durable state schema already documented** under `.omg/state/team/<team>/...`.
4. **Strong quality gate baseline** (typecheck + smoke + integration + reliability + publish contract gates).
5. **Extension-first packaging model** (CLI + extension bundle alignment).

These are strategic strengths; adoption work should not regress them.

---

## 4) Concrete difference matrix (OmC/OmX vs OmG)

| Plane | OmC/OmX strength pattern | OmG As-Is (evidence) | Practical delta |
|---|---|---|---|
| Command plane | Team lifecycle control commands (`status/resume/shutdown`) are first-class | OmG exposes only `team run` at CLI top-level (`src/cli/index.ts`) | Add lifecycle operator commands in OmG CLI and extension prompts |
| Mutation plane | Explicit claim/lease/transition/release flow + mailbox delivery markers (OmX contract) | OmG `TeamStateStore` has CAS task writes and mailbox append/list, but no OmG-native lifecycle API layer | Introduce OmG control-plane APIs as canonical state mutation surface |
| Worker protocol plane | Worker ACK -> claim -> execute -> complete -> idle protocol is explicit and enforced by practice | OmG has worker artifacts and inbox patterns, but enforcement is not a first-class runtime contract | Promote protocol to enforceable OmG contract with failure taxonomy |
| Runtime truthfulness | Completion tied to verified terminal conditions + task terminality | OmG checklist is good, but legacy toggles (`OMG_LEGACY_*`) still allow compatibility bypass | Put legacy toggles on strict deprecation path and audit usage in state/events |
| Role/skill execution plane | Role routing tied to stage semantics + concrete deliverables | OmG has 21-role catalog + parsing, but extension skill surface is plan-heavy and role outputs are unschematized | Add role output schema + minimal role-linked skill set |
| Subagent runtime maturity | Team semantics are operational (not purely synthetic snapshots) | OmG subagents backend currently returns deterministic completed snapshots | Upgrade to staged/evidence-bearing subagent execution semantics |
| Operator runbook plane | Native lifecycle ops and operational runbooks use product commands | OmG live e2e runbook still depends on `omx team ...` flows | Replace with OmG-native operator runbook + e2e evidence |

---

## 5) Architecture deltas OmG should implement

## Delta A — Add explicit Team Control Plane layer

New internal layer (`src/team/control-plane/*`) should own:

- task claim/lease/transition/release,
- mailbox send/notified/delivered semantics,
- worker protocol compliance helpers,
- state mutation guards and transition validation.

Why: OmG currently has good state primitives but lacks a unifying operational control API.

## Delta B — Expand `omg team` lifecycle command surface

Add:

- `omg team status --team <name> [--json]`
- `omg team resume --team <name> [--json]`
- `omg team shutdown --team <name> [--force] [--json]`

Why: closes the largest operator-plane gap without changing core runtime policy.

## Delta C — Role-to-skill-to-evidence contract registry

Add a contract registry for core roles (`planner`, `executor`, `verifier`, `reviewer`) with:

- required inputs,
- required output fields/artifacts,
- required verification evidence,
- failure/escalation behavior.

Why: role selection without output contract is not operational orchestration.

## Delta D — Subagents realism graduation path

Keep subagents opt-in, but evolve from synthetic completion to staged runtime signals:

- in-progress markers,
- per-role artifact pointers,
- role completion evidence in snapshot metadata,
- verify-gate coupling to role evidence completeness.

## Delta E — Compatibility and namespace migration governance

- Formal deprecation lifecycle for `OMG_LEGACY_RUNNING_SUCCESS` and `OMG_LEGACY_VERIFY_GATE_PASS`.
- Plan dual-read migration for team worker env naming (`OMX_TEAM_*` to OmG-native `OMG_TEAM_*`) with explicit cutoff criteria.

---

## 6) Migration constraints (hard constraints)

1. Preserve backward-read compatibility for legacy task/mailbox/phase payloads during migration window.
2. Keep existing public commands stable (`setup`, `doctor`, `team run`, `verify`) while adding new lifecycle commands.
3. Keep defaults unchanged (`tmux` default, `workers 1..8`, fix-loop cap `<=3`).
4. Maintain single-writer/serialized state semantics (no ad-hoc bypass writes).
5. Roll out high-risk behavior under feature flags first (protocol strictness, subagent realism).
6. Keep docs/CLI/help/extension prompts synchronized per release.

---

## 7) Adopt / Adapt / Defer summary

### Adopt now

- OmX-style mutation contract rigor,
- OmX-style lifecycle command operability,
- strict worker protocol sequencing and evidence requirements.

### Adapt for OmG

- OmC staged role routing ideas, but keep OmG’s lean command surface,
- role/skill expansion in minimal, high-signal waves (not full catalog parity in one release).

### Defer

- per-subagent model divergence,
- broad command-surface expansion beyond lifecycle and control-plane essentials,
- dashboard/productization before control-plane parity and verification integrity are stabilized.

---

## 8) Bottom line

OmG already has the right structural base (typed runtime abstraction, durable state, and strong gate discipline).  
Its main deficit versus OmC/OmX is **operational control-plane depth**, not architectural direction.

So the OmG-native path is clear:

1. keep extension-first + tmux-default,
2. add OmX-grade control-plane semantics and lifecycle operations,
3. add OmC-grade role/skill execution contracts with evidence-backed verification.
