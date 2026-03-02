# OmG-native adoption analysis: OmC/OmX orchestration + role/skill capabilities (Worker 5)

Date: 2026-03-02  
Author: worker-5  
Scope: concrete capability deltas and architecture-level adoption blueprint for `oh-my-gemini`

---

## 1) Objective

Define **how OmG should adopt the strongest parts of OmC/OmX** for:

1. Team orchestration (runtime + control-plane)
2. Role/skill-based work decomposition

…while preserving OmG’s product identity:

- extension-first Gemini UX (`extensions/oh-my-gemini`)
- typed orchestration core (`src/team/*`)
- deterministic durable state under `.omg/state`

---

## 2) Evidence baseline (repo-local)

### 2.1 OmG evidence

- CLI surface: `src/cli/index.ts`, `docs/omg/commands.md`
- Team run parsing/contracts: `src/cli/commands/team-run.ts`
- Orchestrator loop + success checklist: `src/team/team-orchestrator.ts`
- Runtime abstraction/backends: `src/team/runtime/runtime-backend.ts`, `src/team/runtime/tmux-backend.ts`, `src/team/runtime/subagents-backend.ts`
- State contract: `src/state/team-state-store.ts`, `docs/architecture/state-schema.md`
- Reliability expectations: `docs/architecture/runtime-backend.md`, `docs/testing/gates.md`
- Role inventory + catalog loading: `src/team/subagents-blueprint.ts`, `src/team/subagents-catalog.ts`, `.gemini/agents/catalog.json`
- Extension skill surface: `extensions/oh-my-gemini/skills/plan/SKILL.md`

### 2.2 OmX evidence

- Team operational skill contract: `.omx/tmp/oh-my-codex/skills/team/SKILL.md`
- CLI command breadth references: `.omx/tmp/oh-my-codex/README.md`

### 2.3 OmC evidence

- Team staged pipeline + routing model: `.omx/tmp/oh-my-claudecode/skills/team/SKILL.md`
- Product/skill breadth references: `.omx/tmp/oh-my-claudecode/README.md`

---

## 3) Executive thesis

OmG should **not** clone OmC/OmX UX wholesale. It should:

1. Keep OmG’s minimal, typed, extension-first architecture.
2. Import OmX’s strict team control-plane semantics (claim/lease/transition, lifecycle ops).
3. Import OmC’s stage-aware role routing and handoff discipline.
4. Bind both to OmG verification gates so "completed" always means verified truth.

---

## 4) Capability delta matrix (concrete)

| Capability | OmC/OmX strength pattern | OmG current state (evidence) | OmG-native target | Delta severity |
|---|---|---|---|---|
| Team lifecycle command set | `start/status/resume/shutdown` operational loop (OmX) | `team run` only (`src/cli/index.ts`, `docs/omg/commands.md`) | Add `omg team status`, `omg team resume`, `omg team shutdown` | Critical |
| Team control-plane mutation | Explicit task claim + lifecycle transitions (OmX) | State schema documents task CAS, but runtime path still run-centric and mixed protocol usage | First-class control-plane APIs as the only mutation path | Critical |
| Worker bootstrap protocol | ACK/claim/result/status-idle contracts formalized in team skill docs (OmX/OmC) | Partial protocol appears in team overlays; not fully productized in OmG CLI docs | Promote worker protocol to documented OmG contract + runtime enforcement | High |
| Role-to-execution contract | OmC stage routing (`team-plan -> team-prd -> team-exec -> team-verify -> team-fix`) | OmG has role catalog + parsing, but weak role output contract and few extension skills | Introduce role output schema + stage handoff artifacts | Critical |
| Skill surface breadth | OmC/OmX have broad skill catalogs | OmG extension skills currently centered on `plan` | Add minimal high-value skill set: team/review/verify/handoff | High |
| Runtime truthfulness | OmX treats runtime + state rigorously | OmG has temporary legacy toggles (`OMG_LEGACY_*`) for verify/running success paths | Sunset legacy toggles behind strict deprecation gates | Critical |
| Runtime backend parity | OmX tmux backend is operationally deep | OmG subagents backend is still deterministic/experimental (`subagents-backend.ts`) | Preserve opt-in but require stronger parity checks before wider defaulting | High |
| Trust boundary hardening | OmX team tools emphasize sanitized IDs/workdir control | OmG sanitizes some names but needs stronger explicit trust-boundary policy | Add explicit identifier/workdir policy layer + tests | High |
| Operator UX | OmX/OmC provide operator-first guidance for long-running teams | OmG has docs + e2e script but still depends on `omx team` for live operator path (`docs/testing/live-team-e2e.md`) | Move operator e2e to OmG-native lifecycle commands | High |
| Rollout telemetry | OmX/OmC team modes provide practical operational evidence loops | OmG has good gate docs but lacks adoption telemetry per role/phase | Add role/phase outcome metrics in verify artifacts | Medium |

---

## 5) Architecture deltas required (OmG current -> OmG target)

## 5.1 Current OmG architecture shape (good foundation)

```text
CLI (setup/doctor/extension/team-run/verify)
  -> TeamOrchestrator (plan/exec/verify/fix)
    -> RuntimeBackend (tmux/subagents)
      -> TeamStateStore (.omg/state)
```

Strengths:

- clean backend interface (`RuntimeBackend`)
- deterministic phase model in orchestrator
- documented durable state schema and reliability gates

## 5.2 Missing middle layer: control-plane service

OmG needs an explicit `TeamControlPlane` layer between CLI and state runtime operations.

Target shape:

```text
CLI
  -> TeamControlPlane (status/resume/shutdown/claim/transition/mailbox)
    -> TeamOrchestrator (run path)
    -> TeamStateStore (single mutation authority)
    -> RuntimeBackend adapter (tmux/subagents)
```

Why:

- keeps orchestration and control operations coherent
- avoids ad-hoc task file writes from multiple surfaces
- makes lifecycle commands testable without hard-coding backend internals

## 5.3 Role/skill contract layer is missing

Current mismatch:

- Role supply exists (`subagents-blueprint.ts`, `catalog.json`)
- Role execution contract does not (required artifacts/acceptance/evidence per role)

Needed component:

- `RoleSkillContractRegistry` (spec-driven)
  - role input contract
  - required outputs (artifact path + schema)
  - verification checks to run
  - escalation behavior on failure

## 5.4 Protocol consistency gap: state API vs direct task writes

Architecture docs say state-store API is canonical for tasks/mailbox, but worker overlays can still instruct direct JSON writes.

Required delta:

- formalize a single write path for production mode
- allow direct write only in explicitly scoped compatibility mode
- emit warnings/events whenever compatibility mode is used

## 5.5 Namespace migration gap (OMX-prefixed env in OmG runtime path)

`tmux-backend.ts` currently exports worker env with `OMX_TEAM_WORKER` / `OMX_TEAM_STATE_ROOT` even in OmG context.

OmG-native direction:

- introduce canonical `OMG_TEAM_*` naming
- dual-read for compatibility window
- remove `OMX_*` fallback after deprecation period

---

## 6) Adopt / Preserve / Reject matrix

## 6.1 Preserve from current OmG

1. extension-first delivery model
2. strict TypeScript contracts for orchestration state/runtime
3. deterministic phase loop + reliability monitor integration
4. unified subagent model default

## 6.2 Adopt from OmX

1. lifecycle operational commands as first-class CLI surface
2. strict mutation semantics for task lifecycle
3. explicit worker ACK/claim/report protocol with lease safety
4. operational runbook parity (status polling, graceful then forced shutdown)

## 6.3 Adopt from OmC (selectively)

1. stage-aware routing discipline (plan/prd/exec/verify/fix)
2. role specialization policy per stage
3. lightweight stage handoff artifacts to preserve reasoning continuity

## 6.4 Reject (non-goals)

1. uncontrolled command/skill surface sprawl
2. per-worker model heterogeneity in initial OmG adoption phase
3. implicit compatibility shortcuts that can produce false-green completion

---

## 7) OmG-native acceptance invariants (must hold)

1. **Completion truth invariant**: no run is `completed` unless verify baseline and required tasks pass.
2. **Single mutation invariant**: all lifecycle state writes go through canonical control-plane/state APIs.
3. **Protocol invariant**: every worker must ACK -> claim -> execute -> report -> idle.
4. **Role evidence invariant**: every role execution leaves structured artifacts with schema-verifiable outputs.
5. **Operator invariant**: status/resume/shutdown must be available without fallback to OmX tooling.

---

## 8) Recommended first moves (highest leverage)

1. Add `team status/resume/shutdown` CLI and control-plane module.
2. Freeze worker protocol spec and enforce it via runtime checks.
3. Add `role -> artifact -> verify` schema definitions for core roles (`planner`, `executor`, `verifier`).
4. Gate legacy compatibility paths in CI (warn -> block).
5. Replace OmX-dependent live operator e2e with OmG-native lifecycle e2e.

These five moves create the minimum credible parity bridge without sacrificing OmG identity.
