# Ralplan-ready Task Decomposition: OmG-native Orchestration + Role/Skill Adoption

_Date: 2026-03-02_  
_Use with:_ `/plan --consensus` or team planning workflows.

## Planning assumptions

- tmux remains default backend.
- subagents remains opt-in until parity criteria pass.
- phase model remains `plan -> exec -> verify -> fix -> completed|failed`.
- all tasks below require code + docs + tests unless marked docs-only.

---

## Dependency graph (epic-level)

- **E0 Decision Lock** -> prerequisite for all epics
- **E1 Control Plane Core** -> prerequisite for E2, E3, E5
- **E2 Lifecycle CLI Parity** -> prerequisite for E6 rollout default-on
- **E3 Worker Protocol Enforcement** -> prerequisite for E5 gate hardening
- **E4 Role/Skill Contract** -> prerequisite for E5 gate hardening
- **E5 Verification/Gate Hardening** -> prerequisite for E6 rollout
- **E6 Rollout + Deprecation** -> terminal epic

---

## Epic E0 — Decision Lock + Contract Freeze

| ID | Priority | Task | Depends on | Output |
|---|---|---|---|---|
| E0-T1 | P0 | Freeze OmG-native adoption principles | - | Approved ADR/RFC |
| E0-T2 | P0 | Freeze control-plane API vocabulary | E0-T1 | API contract doc |
| E0-T3 | P0 | Freeze failure taxonomy | E0-T1 | Shared error-code table |
| E0-T4 | P0 | Freeze CI gate promotion rules | E0-T1 | Gate promotion matrix |

**DoD**

- No open architecture blockers for E1/E2 kickoff.

---

## Epic E1 — Control-plane Core (Task lifecycle + Mailbox)

| ID | Priority | Task | Depends on | Suggested files |
|---|---|---|---|---|
| E1-T1 | P0 | Introduce control-plane module skeleton | E0-T2 | `src/team/control-plane/*` |
| E1-T2 | P0 | Implement task claim API (lease + token) | E1-T1 | control-plane + state adapters |
| E1-T3 | P0 | Implement transition API (`from -> to`) | E1-T2 | control-plane + state adapters |
| E1-T4 | P0 | Implement claim release API | E1-T2 | control-plane + state adapters |
| E1-T5 | P0 | Implement mailbox send/list/notified/delivered APIs | E1-T1 | control-plane mailbox module |
| E1-T6 | P0 | Persist deterministic transition/event logs | E1-T3,E1-T5 | state/event writing path |
| E1-T7 | P0 | Add reliability tests for contention/lease/CAS | E1-T2,E1-T3,E1-T4 | `tests/reliability/*` |

**DoD**

- Control-plane operations are test-backed and callable from orchestrator path.

---

## Epic E2 — Lifecycle CLI Parity (`team status/resume/shutdown`)

| ID | Priority | Task | Depends on | Suggested files |
|---|---|---|---|---|
| E2-T1 | P0 | Add CLI parser support for team subcommands | E0-T1 | `src/cli/index.ts` |
| E2-T2 | P0 | Implement `team status` command | E1-T6 | `src/cli/commands/team-status.ts` |
| E2-T3 | P0 | Implement `team resume` command | E1-T6 | `src/cli/commands/team-resume.ts` |
| E2-T4 | P0 | Implement `team shutdown` command | E1-T6 | `src/cli/commands/team-shutdown.ts` |
| E2-T5 | P0 | Update docs for command contracts | E2-T2,E2-T3,E2-T4 | `docs/omg/commands.md` |
| E2-T6 | P0 | Add integration tests for lifecycle commands | E2-T2,E2-T3,E2-T4 | `tests/integration/*` |

**DoD**

- Team operations are possible without external `omx team` tooling.

---

## Epic E3 — tmux Worker Protocol Enforcement

| ID | Priority | Task | Depends on | Suggested files |
|---|---|---|---|---|
| E3-T1 | P0 | Define worker protocol schema (ACK/claim/result/status) | E0-T2 | docs + types |
| E3-T2 | P0 | Enforce startup ACK requirement | E1-T5 | runtime + monitor |
| E3-T3 | P0 | Enforce claim-before-work requirement | E1-T2 | runtime + control-plane |
| E3-T4 | P0 | Enforce completion payload contract | E1-T3 | runtime + control-plane |
| E3-T5 | P1 | Add worker protocol conformance monitor checks | E3-T2,E3-T3,E3-T4 | `src/team/monitor.ts` |
| E3-T6 | P1 | Add protocol failure integration/reliability tests | E3-T5 | `tests/reliability/*` |

**DoD**

- Protocol violations produce deterministic run failure with actionable reason.

---

## Epic E4 — Role/Skill Contract + Extension Skill Expansion

| ID | Priority | Task | Depends on | Suggested files |
|---|---|---|---|---|
| E4-T1 | P1 | Define role-to-skill contract schema | E0-T2 | `docs/architecture/*` (new doc) |
| E4-T2 | P1 | Implement role-to-skill resolver | E4-T1 | `src/team/*` |
| E4-T3 | P1 | Add core extension skills (`team`,`execute`,`review`,`verify`,`handoff`) | E4-T1 | `skills/*` |
| E4-T4 | P1 | Add parser/contract tests for role mapping | E4-T2,E4-T3 | `tests/reliability/*` |
| E4-T5 | P1 | Add documentation for role evidence obligations | E4-T3 | docs planning/architecture/testing |

**DoD**

- Role selection produces role-specific artifacts and verify evidence.

---

## Epic E5 — Verify/Gate Hardening

| ID | Priority | Task | Depends on | Suggested files |
|---|---|---|---|---|
| E5-T1 | P1 | Add new verify suites or integrate new checks into existing suites | E1,E2,E3,E4 | `src/cli/commands/verify.ts`, tests |
| E5-T2 | P1 | Add CI enforcement for lifecycle/control-plane parity | E5-T1 | `.github/workflows/*` |
| E5-T3 | P1 | Enforce legacy bypass prohibition in release path | E5-T1 | gate scripts/workflows |
| E5-T4 | P1 | Update `docs/testing/gates.md` with new blockers | E5-T2,E5-T3 | docs |
| E5-T5 | P1 | Add operator evidence script updates (live e2e) | E2,E3 | `scripts/e2e-omx-team.sh` or omg-native equivalent |

**DoD**

- CI blocks regressions in lifecycle semantics and worker protocol.

---

## Epic E6 — Rollout + Deprecation

| ID | Priority | Task | Depends on | Suggested files |
|---|---|---|---|---|
| E6-T1 | P2 | Dark-launch flags for new control-plane path | E5 | runtime/config |
| E6-T2 | P2 | Beta rollout with explicit opt-in docs | E6-T1 | setup/docs |
| E6-T3 | P2 | Default-on switch after SLO pass | E6-T2 | runtime/config/docs |
| E6-T4 | P2 | Remove or heavily constrain legacy bypass behavior | E6-T3 | constants/gates/docs |
| E6-T5 | P2 | Publish migration guide + rollback playbook | E6-T3 | docs |

**DoD**

- Default OmG path uses hardened orchestration semantics with documented rollback.

---

## Acceptance criteria by epic

- **E1 complete** when claim/transition/release/mailbox semantics are production-wired and tested.
- **E2 complete** when team lifecycle CLI parity exists with tests and docs.
- **E3 complete** when worker protocol violations fail runs deterministically.
- **E4 complete** when role routing yields verifiable outputs.
- **E5 complete** when CI blocks regressions for E1-E4 guarantees.
- **E6 complete** when default-on rollout is safe and reversible.

---

## Suggested verification command pack per milestone

```bash
npm run typecheck
npm run test:smoke
npm run test:integration
npm run test:reliability
npm run verify -- --json
npm run gate:publish
```

(Plus milestone-specific focused tests for new command/contract surfaces.)

---

## Ralplan bootstrap prompt (copy/paste)

```text
/plan --consensus
Objective: Implement OmG-native adoption of OmC/OmX orchestration discipline.
Use docs/planning/2026-03-02-omg-native-adoption-ralplan-decomposition-worker4.md as source of truth.
Execute by epic order E0->E6 with dependency enforcement.
For each task, require: changed files, tests run, evidence output, rollback note.
Block progression when acceptance criteria for current epic are not met.
```
