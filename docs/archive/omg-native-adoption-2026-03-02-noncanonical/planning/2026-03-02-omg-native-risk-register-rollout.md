# OmG-native Adoption — Risk Register and Rollout Strategy

Date: 2026-03-02  
Depends on: `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis.md`

---

## 1) Risk Register

Scale:

- Probability: Low / Medium / High
- Impact: Low / Medium / High / Critical

| ID | Risk | Probability | Impact | Trigger signal | Mitigation | Contingency |
|---|---|---|---|---|---|---|
| R1 | False-green team completion despite incomplete/failed worker outcomes | Medium | Critical | `phase=completed` with missing evidence or active non-terminal tasks | Enforce claim-safe transitions + verify baseline + required task completion checks | Auto-fail run and emit explicit failure reason taxonomy |
| R2 | Race conditions on task updates under concurrent workers | Medium | High | version conflicts or duplicate task ownership | Introduce claim locks + tokenized transitions | Force release stale claims and retry with bounded backoff |
| R3 | Lifecycle CLI expansion breaks existing `team run` workflows | Low | High | regression in existing integration smoke | Keep backward-compatible parser path and add integration tests for old invocations | Feature flag lifecycle verbs until confidence threshold met |
| R4 | Subagents backend appears reliable but still deterministic-only | Medium | High | role runs complete instantly without real artifact trail | Require role-specific evidence artifact schema and runtime provenance metadata | Keep subagents in opt-in experimental mode |
| R5 | Worker protocol drift across docs/runtime/inbox templates | Medium | Medium | inconsistent instructions in inbox vs implementation | Generate worker protocol from single source module + tests | Block release when protocol contract tests fail |
| R6 | State write durability loss on crash/power interruption | Low | High | partial/old state after abrupt termination | Add fsync mode for lifecycle-critical writes | Recovery command scans and repairs state invariants |
| R7 | Trust-boundary weakness (unsafe team name/path/working dir use) | Low | High | unexpected path writes or traversal attempts | Sanitize IDs, validate roots, reject unsafe paths | Hard-fail and emit security audit event |
| R8 | CI gate fatigue/timeouts from added reliability suites | Medium | Medium | prolonged CI runtime and flaky failures | Isolate deterministic contract tests from live e2e; parallelize suites | Mark live e2e as required only for release candidate branch |
| R9 | Skill surface expansion causes UX inconsistency | Medium | Medium | duplicate or conflicting skill behaviors | Introduce minimal core skill set with strict ownership and docs | Freeze additional skills until core set stability period passes |
| R10 | Legacy bypass flags become permanent hidden dependency | Medium | High | test envs pass only when legacy flags enabled | Add CI assertion that legacy flags are off for blocking gates | Hard block publish when legacy flags detected |

---

## 2) Rollout Strategy

## Wave 0 — Internal hardening (maintainers only)

### Goals

- Land control-plane APIs + lifecycle verbs behind feature toggles.
- Collect reliability and failure telemetry from internal runs.

### Exit criteria

- No critical failures across repeated internal team runs.
- Contract tests stable for claim/transition/release semantics.

---

## Wave 1 — Opt-in preview users

### Goals

- Enable new lifecycle commands for preview adopters.
- Keep legacy path available as fallback.

### Guardrails

- Feature flags default OFF.
- Structured warnings when falling back to legacy compatibility behavior.

### Exit criteria

- Preview cohort confirms operator usability (`status/resume/shutdown`).
- No unresolved critical bugs in task lifecycle semantics.

---

## Wave 2 — Default enablement for new runs

### Goals

- New control-plane path becomes default.
- Legacy compatibility toggles move to explicit escape hatch only.

### Guardrails

- Mandatory CI pass on team-control-plane gate.
- Release notes include migration impact and rollback steps.

### Exit criteria

- Default path stable across smoke/integration/reliability suites.
- Live e2e evidence collected for release candidate.

---

## Wave 3 — Legacy deprecation and cleanup

### Goals

- Remove or hard-disable compatibility shortcuts that permit false-green behavior.
- Finalize documentation and runbooks as SSOT.

### Exit criteria

- Legacy flags not required in any official workflow.
- Publish gates block any attempted legacy bypass usage.

---

## 3) Rollback Strategy

If adoption regressions appear:

1. flip feature flag to legacy path for affected command surface,
2. retain persisted artifacts for forensic diff,
3. run regression triage on failing contract tests,
4. relaunch rollout from previous stable wave only after root-cause fix lands.

---

## 4) Operational Readiness Checklist

Before moving from one wave to the next:

- [ ] Updated docs (`commands`, `runtime-backend`, `state-schema`, `gates`)
- [ ] Blocking CI gates green
- [ ] Live e2e evidence attached
- [ ] Explicit rollback instructions validated
- [ ] No unresolved Critical-risk items

