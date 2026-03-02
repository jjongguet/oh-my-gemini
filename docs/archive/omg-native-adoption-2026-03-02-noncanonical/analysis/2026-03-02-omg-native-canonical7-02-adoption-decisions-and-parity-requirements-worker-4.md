# OmG-native Canonical 02 — Adoption Decisions and Parity Requirements (Worker 4)

Date: 2026-03-02  
Status: **Canonical**  
Depends on: C1

## 1) Current-state baseline (as of 2026-03-02)

Observed OmG baseline from repository evidence:

- CLI currently exposes `setup`, `doctor`, `extension path`, `team run`, `verify` (no first-class `team status/resume/shutdown` yet).
- Durable state and task/mailbox primitives already exist under `.omg/state/team/...` with claim/transition semantics available in state tooling.
- tmux backend is the production default; subagents backend exists but is explicitly experimental/opt-in.
- Subagent catalog exists (`.gemini/agents/catalog.json`) but role-to-output evidence contracts are not yet enforced as a release blocker.

## 2) Final adopt/adapt/reject decisions

### Adopt now (mandatory)

1. OmX-style lifecycle operator surface parity for operational control (`status`, `resume`, `shutdown`).
2. Claim-token-guarded task lifecycle mutations as the single authoritative mutation path.
3. Worker protocol hardening (ACK -> claim -> execute -> report -> idle) as runtime truth contract.
4. Blocking gate expansion tied to orchestration correctness and role evidence integrity.

### Adapt for OmG (mandatory)

1. Preserve extension-first UX; no raw OmC/OmX command tree cloning.
2. Preserve tmux default backend while adding stricter subagents evidence gates.
3. Keep OmG naming/layout conventions for new modules and commands.

### Reject in this cycle (explicit)

1. Massive skill-surface cloning from OmC/OmX before role contract v1 stabilizes.
2. Subagents default-on behavior before parity gates are green.
3. Legacy bypass flags as release-time dependencies.

## 3) Concrete parity requirements (normative)

| Req ID | Requirement (MUST) | Primary implementation targets | Verification signal |
|---|---|---|---|
| P-CLI-01 | Add `omg team status --team <name> [--json]` | `src/cli/index.ts`, new `src/cli/commands/team-status.ts`, `docs/omg/commands.md` | CLI integration tests + docs/help parity checks |
| P-CLI-02 | Add `omg team resume --team <name> [--json]` | `src/cli/index.ts`, new `src/cli/commands/team-resume.ts`, `src/team/team-orchestrator.ts` | Resume scenario integration + reliability tests |
| P-CLI-03 | Add `omg team shutdown --team <name> [--force] [--json]` | `src/cli/index.ts`, new `src/cli/commands/team-shutdown.ts`, runtime adapters | Graceful/force shutdown integration tests |
| P-CP-01 | Centralize task lifecycle mutation via claim/transition/release APIs | `src/state/team-state-store.ts`, new `src/team/control-plane/*` | Contention/invalid-transition tests |
| P-CP-02 | Reject invalid transitions and stale claim tokens deterministically | `src/state/team-state-store.ts`, control-plane transition layer | Reliability negative-path assertions |
| P-WP-01 | Enforce worker bootstrap protocol (ACK before work) in tmux path | `src/team/runtime/tmux-backend.ts`, worker inbox contract docs | Worker protocol gate tests |
| P-WP-02 | Require `status=completed` and structured `result`/`error` reporting before idle | runtime protocol validators + state writes | End-to-end worker lifecycle traces |
| P-RS-01 | Define role contract v1 for `planner`, `executor`, `verifier` | new `src/team/contracts.ts`, extension role docs/skills | Role artifact schema validation |
| P-RS-02 | Require deterministic artifact paths for role outputs | `docs/architecture/state-schema.md`, new artifact writer paths | Artifact presence + schema checks |
| P-RT-01 | Keep tmux default; subagents completion requires same evidence checklist | `src/team/runtime/runtime-backend.ts`, `subagents-backend.ts` | Cross-backend parity checks |
| P-GATE-01 | Expand CI gates from C0/C1/C2 to C0..C7 before GA | `.github/workflows/ci.yml`, `docs/testing/gates.md`, verify scripts | Blocking gate pass evidence bundle |
| P-OBS-01 | Emit auditable events for claim/transition/protocol failures | state events + monitor outputs | Event log + monitor assertions |

## 4) Non-negotiable parity invariants

1. **Completion truth invariant**: no team run is “completed” unless required tasks are terminal-correct and verification baseline passed.
2. **Single mutation invariant**: runtime paths do not directly mutate lifecycle fields outside control-plane APIs.
3. **Protocol invariant**: worker runs that skip ACK/claim/report cannot be treated as successful.
4. **Role evidence invariant**: required roles must output schema-valid artifacts to satisfy parity.
5. **Operator invariant**: `team status/resume/shutdown` exists and is test-covered before rollout beyond Ring 0.

## 5) Definition of parity-complete for this program

Parity is considered complete only when all of the following are true:

- P-CLI, P-CP, P-WP, P-RS, P-RT, P-GATE, and P-OBS requirements pass in CI.
- At least one live operator rehearsal captures `run -> status -> shutdown` and recovery (`resume`) evidence.
- Legacy bypass flags are no longer required for green baseline in release-bound branches.
