# C1 — Program Charter and Decision Record

Date: 2026-03-02  
Audience: OmG maintainers executing OmC/OmX parity adoption for Team Orchestration + Agent Role/Skill behavior.

## 1) Mission

Adopt OmX/OmC strengths where they improve execution truthfulness and operator control, while preserving OmG identity:
- extension-first UX,
- tmux as default backend,
- deterministic file-backed state,
- verify-gated release discipline.

## 2) Scope (in)

1. Team lifecycle control surface (`run/status/resume/shutdown`)
2. Control-plane APIs for claim/transition/release and mailbox lifecycle
3. Worker bootstrap/run/complete protocol enforcement
4. Role -> skill -> evidence execution contract
5. CI/release gates proving parity behavior
6. Risk, rollout, rollback governance

## 3) Scope (out)

1. Replacing tmux as default runtime backend
2. Replatforming state storage away from deterministic file JSON/NDJSON
3. Full OmC/OmX feature cloning outside orchestration + role/skill axis
4. Breaking CLI behavior without compatibility policy

## 4) Final decisions (authoritative)

| Decision ID | Decision |
|---|---|
| D-01 | Official lifecycle command set is `omg team run|status|resume|shutdown` |
| D-02 | Control-plane is a first-class internal layer between CLI/runtime and state store |
| D-03 | Task work MUST be claim-gated; transitions MUST be claim-token guarded |
| D-04 | Worker protocol is mandatory in tmux backend: ACK -> claim -> execute -> result -> idle/fail |
| D-05 | Minimum required role band: planner/executor/verifier |
| D-06 | Skills MUST emit verification-ready evidence artifacts |
| D-07 | Legacy compatibility flags are permitted only as audited migration aids, never release bypasses |
| D-08 | Namespace migration follows dual-read then strict `OMG_*` enforcement |
| D-09 | One canonical phase model (P0..P5) and one rollout model (Ring 0..3) |
| D-10 | C1..C7 are the only decision-authoritative docs |

## 5) Program invariants (SHALL)

- INV-01: OmG SHALL preserve extension-first ergonomics while adding lifecycle/operator depth.
- INV-02: OmG SHALL not report successful orchestration if task lifecycle integrity fails.
- INV-03: Runtime status SHALL be derivable from control-plane truth, not ad-hoc logs only.
- INV-04: Worker completion SHALL include structured verification evidence.
- INV-05: Release SHALL fail if unsafe migration bypasses are enabled in blocking pipelines.

## 6) Contradiction closures from prior docs

1. **Phase-count drift** (5 vs 6 vs 7): locked to **6 phases** (P0..P5).
2. **Rollout naming drift** (Wave/Stage/Ring): locked to **Ring 0..3**.
3. **Lifecycle verb drift** (`start` vs `run`): locked to `run`; `start` not canonical.
4. **API name drift**: locked to `claimTask`, `transitionTaskStatus`, `releaseTaskClaim`.
5. **Mutation path drift**: runtime mutations must use control-plane APIs.

## 7) Implementation parity requirements

- PR-C1-01: `src/cli/index.ts` shall expose lifecycle commands in help/dispatch.
- PR-C1-02: extensions command docs shall match CLI lifecycle surface exactly.
- PR-C1-03: worker protocol must be testable in both simulated and tmux-integrated flows.
- PR-C1-04: every phase exit in C5 must map to at least one blocking/non-blocking gate in C6.

## 8) Definition of parity completion (program-level)

Parity is complete only when:
1. lifecycle commands are real and reliable,
2. task lifecycle semantics are deterministic under contention/failure,
3. worker protocol is enforced end-to-end,
4. role/skill outputs are schema-valid with verification evidence,
5. CI/release gates block false-green paths,
6. rollout can progress ring-by-ring with rollback safety.

