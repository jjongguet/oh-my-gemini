# C2 — Capability Parity Matrix (OmG vs OmX/OmC)

## 1) Matrix

| Domain | OmG current gap (summary) | OmX/OmC reference strength | OmG parity requirement (SHALL) | Primary implementation surface | Proof requirement |
|---|---|---|---|---|---|
| Lifecycle command surface | `team run` centered; operator lifecycle incomplete | First-class lifecycle operations | Implement `team status`, `team resume`, `team shutdown` with deterministic behavior | `src/cli/index.ts`, `src/cli/commands/*`, `extensions/oh-my-gemini/commands/team/*` | command contract tests + UX docs parity |
| Task claim semantics | Claim fields exist but behavior not consistently first-class | Claim/lease/ownership discipline | `claimTask` shall enforce ownership, lease, and dependency readiness | `src/state/team-state-store.ts`, new control-plane module | reliability tests for conflicts + blocked deps |
| Transition legality | Transition APIs not fully normalized across all paths | Illegal transitions rejected deterministically | `transitionTaskStatus` shall enforce legal FSM + claim token | control-plane + state transition guard helpers | invalid transition rejection tests |
| Claim release semantics | Release behavior not uniformly surfaced | Explicit claim release path | `releaseTaskClaim` shall safely return tasks to pending/retriable states | control-plane + state | stale/expired claim tests |
| Worker bootstrap contract | Protocol partially documented, not uniformly enforced | Strict ACK->claim->execute->result->idle flow | tmux worker execution shall require ACK and claim-before-work | `src/team/runtime/tmux-backend.ts`, team orchestrator | tmux integration test with protocol assertions |
| Role/skill contract | Roles/skills available but output contract not strict | Role-specialized execution with artifacts | planner/executor/verifier outputs shall be schema-valid + evidence-bearing | extension skills + orchestration contracts | schema validation + verifier checks |
| Runtime truthfulness | Runtime success may drift from lifecycle truth | Execution tied to task/control-plane truth | success reporting shall require lifecycle integrity and worker state consistency | `src/team/monitor.ts`, orchestrator | consistency tests under failure/restart |
| Observability | Snapshot exists; taxonomy not unified | Clear operator-grade status signals | failure reason taxonomy shall be explicit and user-facing | monitor/status command + docs | status snapshot regression tests |
| Security/trust boundary | Legacy bypass flags risk false-green | Explicit safe/unsafe separation | release jobs shall hard-fail on unsafe bypass activation | `.github/workflows/*`, verify/gate scripts | release gate tests |
| CI/release posture | Strong base gates, parity gates fragmented | Broad contract gating | lifecycle/control-plane/protocol/role gates shall be codified as blocking by rollout stage | scripts + CI workflows | end-to-end gate matrix green |

## 2) Normalized acceptance anchors

- A1: lifecycle CLI contract proven
- A2: claim/transition/release semantics deterministic under contention
- A3: worker protocol enforced in tmux runtime path
- A4: role/skill evidence contract validated
- A5: release false-green protections active

## 3) Non-goal matrix

| Candidate adoption | Status | Reason |
|---|---|---|
| Replace file-based state with DB | Reject now | Violates current OmG deterministic-state architecture goal |
| Make subagents default backend immediately | Reject now | Conflicts with tmux-default roadmap intent |
| Remove all compatibility flags in one step | Defer | Needs staged migration with rollback |
| Expand role catalog beyond minimum set before contract hardening | Defer | Increases surface before foundation stability |

