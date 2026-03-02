# OmG-native Final Canonical Set (02/07): Parity Decisions and Implementation Requirements

Date: 2026-03-02  
Status: **Normative (must-hold requirements)**

## 1) As-is baseline (repo evidence)

Current OmG strengths to preserve:
- extension-first UX and packaging
- tmux-default backend with subagents opt-in
- deterministic state persistence under `.omg/state`
- verification-first culture (`typecheck`, `test`, `verify`, publish gate)

Current critical gaps to close for OmC/OmX orchestration parity:
- lifecycle operator surface mostly centered on `team run`
- no first-class control-plane claim/transition/release contract in OmG code
- worker protocol and role/skill evidence contracts are not uniformly enforced end-to-end

## 2) Final adoption strategy (adopt / adapt / defer)

| Domain | Decision | Canonical direction |
|---|---|---|
| Team control-plane rigor | **Adopt now** | Claim token + lease + legal transition + release semantics |
| Lifecycle CLI operability | **Adopt now** | Add `status/resume/shutdown` without breaking `team run` |
| Worker protocol discipline | **Adopt now** | Enforce ACK -> claim -> execute -> result -> idle |
| Role/skill architecture | **Adapt now** | Keep OmG UX; implement role->skill->artifact contract |
| Subagents completeness claims | **Defer strict parity** | Keep opt-in until artifact-backed runtime truth is proven |
| Broad command/skill cloning | **Reject this cycle** | No wholesale OmC/OmX surface cloning |

## 3) Parity requirements (concrete and testable)

| Req ID | Requirement | Required implementation parity | Evidence / verification |
|---|---|---|---|
| PR-CLI-01 | Lifecycle command expansion | `src/cli/index.ts` accepts `team status`, `team resume`, `team shutdown` + corresponding command handlers | Integration tests for command parse + runtime behavior |
| PR-CLI-02 | Backward compatibility | Existing `omg team run` behavior and options remain valid | Existing + new integration tests both green |
| PR-CLI-03 | Command docs parity | CLI help, `docs/omg/commands.md`, extension command prompts stay aligned | Docs contract checks + smoke command checks |
| PR-CP-01 | Claim API | Add control-plane claim entrypoint returning owner token + lease expiry | Reliability tests: claim conflict, stale lease, dependency blocked |
| PR-CP-02 | Transition API | Add guarded transition entrypoint (`from`,`to`,`claimToken`) with deterministic errors | Reliability tests for legal/illegal transitions |
| PR-CP-03 | Release API | Add claim release entrypoint with token/owner validation | Reliability tests for release correctness and stale ownership |
| PR-CP-04 | Mutation hardening | New runtime paths must not directly overwrite task lifecycle fields bypassing control-plane APIs | Static path audit + reliability assertions |
| PR-WP-01 | Worker bootstrap protocol | tmux worker flow enforces identity resolution + lead ACK + inbox/task lookup | Live team e2e evidence + worker protocol tests |
| PR-WP-02 | Claim-before-work | Worker cannot start execution or mark progress without a valid claim token | Reliability tests + e2e negative scenario |
| PR-WP-03 | Structured completion evidence | Worker completion payload must include verification evidence summary | Integration/reliability assertions on result shape |
| PR-RS-01 | Role baseline contract | Required roles: `planner`, `executor`, `verifier` with explicit I/O expectations | Role contract tests + example artifacts |
| PR-RS-02 | Skill baseline contract | Required skills: `plan`, `execute`, `review`, `verify`, `handoff` | Extension skill smoke checks + schema assertions |
| PR-RS-03 | Artifact determinism | Role outputs stored with deterministic, discoverable paths under team state | Integration checks on output paths |
| PR-RT-01 | Runtime policy | tmux remains default; subagents remains explicit opt-in while parity gates are incomplete | CLI and docs checks; regression tests |
| PR-OBS-01 | Reason taxonomy | Runtime/control-plane failures emit deterministic reason codes | Snapshot/assertion tests for failure reasons |
| PR-GATE-01 | Gate expansion | Add adoption gates `G1..G5` into CI/release path incrementally | CI workflow evidence |
| PR-GATE-02 | Legacy bypass control | Release gating fails when legacy bypass flags are needed for green baseline | Gate script assertions |

## 4) Completion definition for parity work

Parity is achieved only when all PR requirements above are true simultaneously:
1. command surface parity is implemented,
2. control-plane lifecycle integrity is enforced,
3. worker protocol is runtime-enforced,
4. role/skill artifacts are schema-valid,
5. gates are green with legacy bypasses disabled.

