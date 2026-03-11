# OmG-native Adoption of OmC/OmX Team Orchestration + Role/Skill Capabilities

_Date: 2026-03-02_  
_Author: worker-4 (team: analyze-in-extreme-detail-how)_

## 1) Objective

Define how **oh-my-gemini (OmG)** should adopt the strongest orchestration patterns from **oh-my-codex (OmX)** and **oh-my-claudecode (OmC)** while preserving OmG’s own constraints:

- extension-first UX,
- tmux as default backend,
- subagents as opt-in,
- deterministic state + verify-gated delivery.

This document is the master synthesis; detailed execution artifacts are linked in:

- `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md`

---

## 2) Evidence Base (current repository)

### OmG (as-is)

- CLI surface: `src/cli/index.ts`, `src/cli/commands/team-run.ts`
- Runtime contract + implementations:
  - `src/team/runtime/runtime-backend.ts`
  - `src/team/runtime/tmux-backend.ts`
  - `src/team/runtime/subagents-backend.ts`
- Orchestration/health/state:
  - `src/team/team-orchestrator.ts`
  - `src/team/monitor.ts`
  - `src/state/team-state-store.ts`
  - `docs/architecture/runtime-backend.md`
  - `docs/architecture/state-schema.md`
- Current skill/extension surface:
  - `skills/plan/SKILL.md`
  - `commands/omg/team/*.toml`

### Existing comparison/planning artifacts in this repo

- `docs/analysis/omc-omx-omg-adversarial-comparison.md`
- `docs/analysis/omc-omx-team-orchestration-role-skill-todo.md`
- `docs/planning/2026-03-02-team-orchestration-role-skill-master-todo.md`

### OmX/OmC reference snapshots used for feature-shape comparison

- `.omx/tmp/oh-my-codex/README.md`, `.omx/tmp/oh-my-codex/src/cli/team.ts`, `.omx/tmp/oh-my-codex/src/team/team-ops.ts`, `.omx/tmp/oh-my-codex/src/team/worker-bootstrap.ts`
- `.omx/tmp/oh-my-claudecode/README.md`

---

## 3) Strategic Conclusion (short)

**Do not clone OmX/OmC product surfaces.**  
**Do absorb OmX-grade control-plane rigor and OmC-grade role workflow ergonomics into OmG’s extension-first architecture.**

In practice:

1. Keep OmG’s packaging and boundaries.
2. Add missing team lifecycle + control-plane semantics.
3. Make role selection produce real, verifiable work artifacts (not only routing metadata).
4. Gate everything through explicit verify + state evidence.

---

## 4) Concrete Differences and OmG-native Adoption Decisions

| Area | OmX / OmC Pattern | OmG As-Is | OmG-native Adoption Decision |
|---|---|---|---|
| Team lifecycle commands | `team start/status/resume/shutdown` as first-class ops | `omg team run` only | Add `omg team status`, `omg team resume`, `omg team shutdown` (P0) |
| Control-plane API | Explicit task claim/transition/release + mailbox ops | Durable files exist, but no first-class claim/transition API in OmG CLI/runtime path | Add OmG control-plane module + API contract (`claimTask`, `transitionTask`, `releaseClaim`, mailbox delivery semantics) |
| Worker protocol | Strict bootstrap protocol (ACK → claim → work → result → idle) | tmux backend starts shell commands; no enforced worker lifecycle contract | Adopt worker protocol as contractual run requirement for tmux mode |
| Runtime truthfulness | Execution state tightly coupled to task lifecycle | tmux default command can complete quickly; subagents backend is deterministic-complete | Require runtime success only when control-plane tasks also terminal-valid |
| Role/skill pipeline | Rich role + skill ecosystems, explicit mode scaffolding | Role catalog exists (21 blueprint roles), extension skill surface is narrow (`plan`) | Introduce role-to-skill map + minimum core skills (`team`, `execute`, `review`, `verify`, `handoff`) |
| Trust boundary controls | Explicit unsafe modes + operational visibility | Legacy compatibility envs can soften success gates | Preserve compatibility only behind audited, non-release-safe flags |
| Operator observability | Frequent status/hud surfaces | Basic monitor snapshot + verify report | Add team status summary and runbook-standard failure taxonomy |
| CI/release posture | Mature but broader/legacy-heavy | Strong gating structure (`gate:global-install-contract`, `gate:publish`, verify suites) | Keep OmG gate discipline and extend with new orchestration parity gates |

---

## 5) Required Architectural Deltas

## Delta A — Introduce explicit Team Control Plane layer

Create a dedicated layer between `TeamOrchestrator` and state filesystem operations:

- responsibility: task lifecycle transitions, mailbox semantics, worker coordination,
- avoids ad hoc direct state writes by runtime workers,
- keeps runtime adapters (`tmux`, `subagents`) focused on process orchestration.

**Target modules (proposed):**

- `src/team/control-plane/index.ts`
- `src/team/control-plane/task-lifecycle.ts`
- `src/team/control-plane/mailbox.ts`
- `src/team/control-plane/worker-protocol.ts`

## Delta B — Promote task claim/lease semantics from data fields to behavior

`src/state/team-state-store.ts` already carries `claim` fields in task records, but behavioral semantics are not yet first-class in OmG runtime flow.

Adopt:

- `claimTask(taskId, worker, leaseMs)`
- `transitionTaskStatus(taskId, from, to, claimToken)`
- `releaseTaskClaim(taskId, claimToken)`

with deterministic error taxonomy (CAS mismatch, lease expired, wrong owner, invalid transition).

## Delta C — Expand CLI lifecycle surface

Extend `src/cli/index.ts` + new command handlers:

- `team status` (read + summarize phase/tasks/workers/health)
- `team resume` (reattach/reconstruct handle and continue orchestrator loop)
- `team shutdown` (graceful + force modes)

This closes the biggest operational gap vs OmX/OmC.

## Delta D — Enforce worker bootstrap protocol in tmux backend

Today tmux is largely pane/process orchestration. Add protocol-level correctness:

- worker identity contract (`worker-<n>`),
- startup ACK requirement,
- mandatory claim-before-work,
- standardized completion payload,
- idle/block/fail terminal status writes.

## Delta E — Role/Skill contract registry

Current state:

- role catalog is strong (`src/team/subagents-blueprint.ts`),
- extension skill catalog is minimal (`skills/plan`).

Add contract mapping:

- role -> expected input schema,
- role -> required evidence schema,
- role -> default skill template,
- role -> verify obligations.

## Delta F — Runtime success gate tightening

Success must require both:

1. runtime backend success,
2. control-plane task terminal validity.

This prevents deterministic false-green outcomes from synthetic completion snapshots.

## Delta G — Failure reason taxonomy + operator-facing diagnostics

Standardize failure codes across monitor/orchestrator/CLI output:

- `runtime_dead_worker`
- `runtime_non_reporting_worker`
- `runtime_watchdog_expired`
- `task_claim_conflict`
- `task_transition_invalid`
- `verify_gate_missing`
- `verify_gate_failed`

## Delta H — Compatibility + unsafe-mode governance

Legacy toggles can remain temporarily, but must be:

- explicit in state/event logs,
- surfaced as warnings in CLI output,
- prohibited in release gates.

---

## 6) Migration Constraints (non-negotiable)

1. **Extension-first must remain primary** (`package root extension surface` is canonical UX surface).
2. **tmux stays default backend**, subagents remain opt-in until parity is proven.
3. **No generated-state hand edits** outside sanctioned state APIs for runtime operations.
4. **ESM compatibility must be preserved** (`type: module`, NodeNext import shape).
5. **State compatibility must be maintained** for existing `.omg/state` contracts.
6. **Phase model must remain canonical**: `plan -> exec -> verify -> fix -> completed|failed`.
7. **Verify-gated delivery cannot be relaxed**; new behavior must increase, not reduce, gate strictness.
8. **Cross-process concurrency safety must improve** beyond in-process write queues.
9. **Role routing must stay deterministic** for same task text + options.
10. **Operator runbooks must stay scriptable** (no hidden GUI-only requirements).

---

## 7) Acceptance Criteria (program-level)

Adoption is complete only when all are true:

1. Team lifecycle parity exists in OmG CLI (`run/status/resume/shutdown`) and is documented.
2. Task claim/transition/release behavior is implemented and tested under contention/failure.
3. tmux workers follow a documented, enforceable protocol with ACK + claim-first discipline.
4. subagents backend can emit role-specific evidence artifacts (not only synthetic completion states).
5. Role-to-skill contract is explicit and versioned.
6. Verify output includes control-plane health and task lifecycle evidence.
7. Release gates fail when unsafe compatibility flags are active.
8. Live operator path (`team:e2e`) can validate status polling + shutdown + cleanup deterministically.

---

## 8) Test/CI Gate Delta (what to add)

Keep existing gates and add orchestration-parity checks:

- **New reliability suites (blocking in C1/C2 once stable):**
  - task claim contention + lease expiry,
  - invalid transition rejection,
  - mailbox delivery/notified dedupe,
  - resume after interrupted run.
- **New integration suites:**
  - `omg team status/resume/shutdown` CLI contract tests,
  - role-tag parsing + role-to-skill execution contract tests.
- **New release check:**
  - reject builds when legacy bypass flags are enabled in CI env.

Use existing command conventions from `package.json` and `docs/testing/gates.md`.

---

## 9) Rollout Strategy (summary)

- **Wave 1 (dark launch):** implement control-plane APIs behind experimental flags.
- **Wave 2 (opt-in beta):** enable new team lifecycle commands + worker protocol in non-default paths.
- **Wave 3 (default-on):** promote lifecycle commands and control-plane semantics as default.
- **Wave 4 (hardening):** remove/retire compatibility bypasses from release path.

Detailed register and rollback triggers:  
`docs/planning/2026-03-02-omg-native-adoption-risk-rollout-worker4.md`

---

## 10) Ralplan-ready decomposition

Actionable task graph (epics, dependencies, acceptance, evidence commands):

- `docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md`

Phased timeline with exit criteria:

- `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md`

---

## 11) Final Recommendation

Adopt **OmX-level orchestration discipline** and **OmC-level role ergonomics**, but keep OmG’s extension-first and verify-gated identity intact.

The winning path is **not feature cloning**; it is **contract-driven capability absorption** with strict runtime truthfulness and CI enforcement.
