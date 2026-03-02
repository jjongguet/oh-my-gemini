# OmG-native Canonical Risk Register, Rollout, and Deprecation Governance

Date: 2026-03-02  
Canonical ID: C7  
Depends on: C2, C5, C6

---

## 1) Canonical risk register

| Risk ID | Risk | Likelihood | Impact | Early signal | Primary mitigation | Owner |
|---|---|---:|---:|---|---|---|
| R-01 | False-green completion despite missing/invalid evidence | M | H | phase marked completed with incomplete task/artifact truth | enforce PAR-RT-01 + verifier-binding + R2/R3 gates | verifier owner |
| R-02 | Task lifecycle races under concurrent workers | M | H | flaky claim/transition behavior | token+lease lifecycle + deterministic transition tests | control-plane owner |
| R-03 | Schema changes break existing readers/scripts | M | H | e2e/script failures on new fields | additive schema policy + compatibility tests | state owner |
| R-04 | Docs/prompt/help drift from actual command surface | H | M | operator command confusion, stale examples | R4 docs contract gate + synchronized release checklist | docs owner |
| R-05 | Role contracts are nominal, not evidence-driven | M | H | runs pass without useful artifacts | schema validation + verifier gate in completion path | role-contract owner |
| R-06 | Subagents claims exceed runtime truth | M | M | parity claims outpace real behavior | staged rollout: artifact-truthful first, then deeper execution | runtime owner |
| R-07 | Lifecycle command expansion degrades UX simplicity | M | M | onboarding/support burden rises | keep minimal operator surface + extension-first guidance | product/docs owner |
| R-08 | tmux stability regressions from protocol hardening | L-M | H | cleanup/restart flakiness | isolate runtime transport concerns; add live e2e checks | runtime owner |
| R-09 | CI runtime inflation slows delivery | M | M | queue delays/flaky long jobs | staged gate rollout + targeted reliability suites | infra owner |
| R-10 | Cross-repo parity chasing dilutes OmG identity | M | M | OmG UX drifts into clone behavior | enforce C2 adopt/adapt/reject policy in design review | architecture owner |

---

## 2) Rollout stages (authoritative)

### Stage 0: Internal design freeze

- Contracts and phase model locked.
- No user-visible defaults changed.
- Dry-run and targeted reliability checks required.

Exit criteria:

- C2/C4/C5/C6 approved,
- control-plane contract ambiguity resolved.

### Stage 1: Canary (opt-in)

- Enable new lifecycle/control-plane behavior for controlled maintainers.
- Capture reason-code telemetry and migration friction.

Exit criteria:

- 7 consecutive days with no high-severity regressions,
- R1/R2 gates stable,
- no unresolved P0 incidents.

### Stage 2: Beta (default-on for repo contributors)

- Lifecycle commands become standard operator path.
- Role artifact contracts active for supported workflows.
- Rollback path remains available for one release cycle.

Exit criteria:

- 2 release cycles with no data-loss/state-corruption incident,
- R1/R2/R3/R4 gates stable,
- operator runbook validated at least twice.

### Stage 3: GA

- Legacy unsafe bypass paths blocked for release.
- Canonical contracts become baseline expectations.
- Migration notes and rollback playbook published.

Exit criteria:

- C0/C1/C2 + R1..R5 all green,
- no unresolved P0/P1 adoption issues,
- release notes include adoption caveats and rollback triggers.

---

## 3) Rollback policy

Immediate rollback triggers:

1. unrecoverable state corruption,
2. non-deterministic task ownership behavior,
3. repeated operator inability to shutdown/resume safely,
4. systematic false-green completion outcomes.

Rollback actions:

1. disable new behavior behind controlled fallback path,
2. preserve state readability (no destructive schema rollback),
3. publish incident summary + corrective test additions,
4. re-enter at previous rollout stage only after gate evidence is repaired.

---

## 4) Legacy/deprecation governance

### 4.1 Runtime/config bypass governance

1. Legacy compatibility toggles may exist during migration window only.
2. Every bypass path must produce explicit telemetry/audit output.
3. Release pipeline must fail when unsafe bypass behavior is active in blocking jobs.
4. Bypass retirement target is end of Stage 3.

### 4.2 Document governance

1. C1-C7 are the only canonical set.
2. Older 26-cycle docs are historical context only (non-canonical).
3. New synthesis/planning updates must edit canonical docs directly.
4. PRs that add parallel “master” docs should be rejected.

---

## 5) Operational readiness checklist

Before promoting rollout stage:

- [ ] Required gates for current stage are green
- [ ] Required runbook/docs updates are merged
- [ ] Risk IDs touched by changes are documented
- [ ] Rollback trigger thresholds are reviewed
- [ ] Legacy bypass posture for this stage is explicitly declared

