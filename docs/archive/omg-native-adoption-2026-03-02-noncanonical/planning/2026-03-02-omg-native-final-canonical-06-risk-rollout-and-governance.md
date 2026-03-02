# OmG-native Final Canonical Set (06/07): Risk Register, Rollout, and Governance

Date: 2026-03-02  
Status: **Authoritative operations governance**
Depends on: FC2, FC4, FC5

## 1) Canonical risk register

| Risk ID | Risk | Probability | Impact | Trigger signal | Primary mitigation | Contingency |
|---|---|---|---|---|---|---|
| R1 | False-green completion without valid evidence | Medium | Critical | run marked complete with non-terminal tasks or missing verification payloads | enforce completion truth checks + evidence schema validation | auto-fail run with reason code |
| R2 | Concurrent task mutation race conditions | Medium | High | conflicting ownership/version behavior | claim token + lease + CAS enforcement | stale-claim recovery and retry policy |
| R3 | Lifecycle command regressions | Low | High | `team run` regressions or broken operator flows | additive CLI rollout + integration tests | feature-flag fallback |
| R4 | Worker protocol drift between docs/runtime/templates | Medium | High | inbox instructions and runtime behavior diverge | single-source protocol contract + tests | block release on protocol test failures |
| R5 | Subagents reports completion without real artifacts | Medium | High | deterministic "complete" snapshots with no evidence | artifact-required completion policy | keep subagents opt-in |
| R6 | Durability/integrity loss on crash | Low | High | partial state writes or stale lifecycle artifacts | atomic writes + recovery checks | recovery command + manual rollback |
| R7 | Trust-boundary weakness in identifiers/paths | Low | High | unsafe path/id usage | strict validation + normalization | hard-fail with security reason code |
| R8 | CI fatigue/flakiness from added gates | Medium | Medium | unstable or slow pipeline | split deterministic vs live tests, parallelize where safe | stage live checks by rollout ring |
| R9 | Legacy bypass flags become hidden dependency | Medium | High | baseline only green with legacy flags enabled | explicit legacy-flag detection gate | release hard block |
| R10 | Docs drift from implemented behavior | Medium | Medium | help/docs/prompts mismatch | docs contract check in release workflow | hotfix docs with gate re-run |

---

## 2) Rollout ring model (fixed)

| Ring | Audience | Defaults | Exit criteria |
|---|---|---|---|
| Ring 0 | maintainers/internal | new behavior behind explicit flags | G1/G2 green, no critical open issues |
| Ring 1 | opt-in preview users | new commands and control-plane paths opt-in | G1/G2/G3 green, operator feedback stable |
| Ring 2 | default for new runs | new lifecycle paths default-on, legacy path escape hatch only | G1..G4 green, no P0 incidents |
| Ring 3 | GA + cleanup | legacy bypass paths disabled for release baseline | G1..G5 green, rollback runbook validated |

---

## 3) Rollback policy

Rollback triggers:
- new critical regression in lifecycle integrity,
- repeated gate failures with no safe minimal fix,
- data integrity risk in `.omg/state` artifacts.

Rollback procedure:
1. switch affected behavior to prior stable path (feature toggle or revert),
2. preserve failing artifacts for forensic diff,
3. run targeted regression pack,
4. resume rollout only after verified fix and gate recovery.

---

## 4) Deprecation governance

1. Canonical docs are FC1–FC7 only.
2. Deprecated docs remain archival references but cannot be cited as authoritative.
3. Legacy runtime compatibility toggles are temporary and auditable.
4. Release-readiness requires proving no mandatory dependency on legacy bypass toggles.

---

## 5) Go / no-go checklist

Before promotion to next ring:
- [ ] required gates are green for current ring
- [ ] no unresolved critical risk with active trigger signal
- [ ] rollback instructions executed successfully at least once in rehearsal
- [ ] docs/CLI/extension command references are aligned
- [ ] owner sign-off recorded for unresolved medium risks

