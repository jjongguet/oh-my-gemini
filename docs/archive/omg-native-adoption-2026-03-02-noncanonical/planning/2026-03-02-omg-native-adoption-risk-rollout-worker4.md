# Risk Register + Rollout Strategy: OmG-native Orchestration/Role-Skill Adoption

_Date: 2026-03-02_  
_Companion docs:_
- `docs/analysis/2026-03-02-omg-native-adoption-master-synthesis-worker4.md`
- `docs/planning/2026-03-02-omg-native-adoption-phased-plan-worker4.md`

## 1) Risk Register

| Risk ID | Risk | Probability | Impact | Early signal | Mitigation | Rollback trigger |
|---|---|---:|---:|---|---|---|
| R1 | False-green completion (runtime says done, tasks not truly done) | High | High | Completed phase with non-terminal tasks | Bind success to control-plane task terminal checks | Any release run shows mismatched task/runtime completion |
| R2 | Cross-process state race/corruption | Medium | High | CAS mismatch spikes, inconsistent task versions | Claim/lease/CAS enforcement + atomic writes + queue discipline | Repeated non-deterministic reliability failures |
| R3 | Worker protocol drift in tmux runs | High | High | Missing ACK or claim-before-work evidence | Protocol conformance checks in monitor + integration tests | >2% protocol failure in beta cohort |
| R4 | CLI UX fragmentation | Medium | Medium | Confusing overlap between old/new commands | Keep command grammar minimal and backward-compatible | High support load or repeated usage errors |
| R5 | Role routing does not produce meaningful outputs | Medium | High | Role-selected runs produce generic/no artifacts | Role-to-skill output schema + verify enforcement | Artifact schema pass rate below threshold |
| R6 | Legacy bypass flags become hidden permanent dependency | Medium | High | CI green only when legacy flags are enabled | Explicit CI gate to block release with legacy flags | Any release candidate needs legacy flags to pass |
| R7 | Docs/code/gates drift | Medium | Medium | Command mismatch across README/docs/help/tests | Update docs + tests in same change set; add docs parity checks | Contract drift detected in CI checks |
| R8 | Subagents parity assumptions fail in real workloads | Medium | Medium | Deterministic completion without real work persists | Keep subagents opt-in until evidence-based parity | Beta incidents show unsupported workload classes |
| R9 | Team lifecycle resume semantics under-specified | Medium | High | Resume produces duplicate or orphan state | Explicit resume contract + snapshot sanity checks | Resume causes state divergence in integration tests |
| R10 | Over-importing OmX/OmC features harms OmG identity | Low | Medium | Growth of unused commands/skills | Apply "adopt behavior, not surface bloat" principle | Feature usage telemetry shows low adoption/high confusion |

---

## 2) Rollout Waves

## Wave A — Dark Launch (internal only)

- Flag-gated control-plane behavior, hidden by default.
- Run full reliability suites plus targeted contention/lease tests.
- No user-facing default behavior changes.

**Promotion criteria**

- zero critical regressions in smoke/integration/reliability,
- deterministic behavior across repeated runs.

## Wave B — Opt-in Beta

- Enable new lifecycle commands (`team status/resume/shutdown`) for opt-in users.
- Keep current `team run` as stable default.
- Collect protocol conformance and failure taxonomy metrics.

**Promotion criteria**

- protocol conformance >= 98%,
- no unresolved P0 incidents,
- docs + operator runbook validated by non-authors.

## Wave C — Default-on

- New lifecycle/control-plane path becomes default.
- Legacy compatibility behavior remains available only as explicit escape hatch.

**Promotion criteria**

- release gate pass rate stable,
- no regression trend in integration/reliability suites,
- incident response playbook validated.

## Wave D — Cleanup / Deprecation

- Remove or strongly constrain legacy bypass behavior.
- Reduce duplicate code paths.
- Finalize migration notes.

**Completion criteria**

- no production dependency on deprecated semantics,
- CI/release workflows contain only hardened path.

---

## 3) Operational SLO-style guardrails for rollout

1. **Determinism guardrail**
   - same input/environment should yield same lifecycle outcome.
2. **Protocol guardrail**
   - missing ACK/claim/result evidence must fail runs.
3. **State integrity guardrail**
   - task CAS/lease violations must be explicit, never silent.
4. **Gate integrity guardrail**
   - release cannot succeed with unsafe compatibility overrides.

---

## 4) Rollback strategy

If severe regressions occur after promotion:

1. flip feature flag back to previous stable mode,
2. preserve run artifacts for forensic diff,
3. run focused reliability pack on failing scenarios,
4. patch and re-qualify in dark-launch stage before re-promotion.

Rollback must be reversible without manual state surgery.

---

## 5) Minimum evidence required before each promotion

- `npm run typecheck`
- `npm run test:smoke`
- `npm run test:integration`
- `npm run test:reliability`
- `npm run verify -- --json`
- milestone-specific live operator evidence (status/resume/shutdown path)

Promotion without evidence should be treated as a release-blocking process failure.
