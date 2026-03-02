# OmG-native Final Canonical Set (05/07): Acceptance Criteria and CI/Release Gates

Date: 2026-03-02  
Status: **Blocking quality contract**
Depends on: FC2, FC3, FC4

## 1) Baseline gates (must remain green)

Existing baseline remains mandatory:
- typecheck
- smoke/integration/reliability suites
- verify workflow
- publish gate chain

No adoption change may regress baseline behavior.

---

## 2) New adoption gates (G1..G5)

| Gate | Scope | Blocking stage |
|---|---|---|
| G1 | Control-plane lifecycle contract | Phase 1 onward |
| G2 | Lifecycle CLI parity | Phase 2 onward |
| G3 | Worker protocol enforcement | Phase 3 onward |
| G4 | Role/skill artifact contract | Phase 4 onward |
| G5 | Release governance (legacy bypass + docs contract) | Phase 5 / release |

---

## 3) Gate definitions

## G1 — Control-plane lifecycle contract

**Must prove**
- claim conflicts deterministic
- stale lease behavior deterministic
- illegal transitions rejected
- dependency-blocked claims rejected

**Command pack**
```bash
npm run typecheck
npm run test:reliability
```

---

## G2 — Lifecycle CLI parity

**Must prove**
- `team status/resume/shutdown` behave correctly
- JSON/text outputs are stable
- `team run` backward compatibility preserved

**Command pack**
```bash
npm run typecheck
npm run test:integration
npm run omg -- team run --task "g2-lifecycle-smoke" --dry-run --json
```

---

## G3 — Worker protocol enforcement

**Must prove**
- ACK/claim/result/idle sequence enforced
- unclaimed execution is rejected
- runtime and state artifacts remain coherent after failures/retries

**Command pack**
```bash
npm run test:reliability
npm run test:integration
npm run team:e2e
```

---

## G4 — Role/skill artifact contract

**Must prove**
- required role outputs exist and are schema-valid
- role routing (explicit + tag-based) is deterministic
- subagents completion includes evidence artifacts

**Command pack**
```bash
npm run test
npm run verify -- --json
```

---

## G5 — Release governance

**Must prove**
- legacy bypass flags do not gate baseline success
- docs/CLI/extension command examples are aligned
- rollback instructions are present and tested

**Command pack**
```bash
npm run typecheck
npm run verify
npm run gate:publish
```

---

## 4) Acceptance criteria by domain

| Domain | Minimum acceptance criteria |
|---|---|
| Lifecycle commands | Valid invocations succeed; invalid invocations fail with actionable errors; status includes phase/task/worker health summary |
| Task lifecycle safety | claim/transition/release semantics enforced with deterministic errors |
| Worker protocol | worker cannot perform lifecycle mutation without claim token |
| Role/skill contract | role outputs + verification evidence are structurally valid |
| Docs/UX contract | README/docs/help/extension prompts agree on command syntax and semantics |

---

## 5) PR evidence format (required)

Every parity PR must include:

```text
Verification:
- PASS: <command> (exit=0)
- PASS: <command> (exit=0)
- FAIL: <command> (exit=1) [if applicable, with fix-followup]

Compatibility:
- Preserved behavior: <list>
- New behavior gated by: <gate IDs>
```

---

## 6) Failure policy

If a gate fails:
1. identify root cause,
2. apply minimal fix,
3. rerun failed gate,
4. repeat up to 3 cycles,
5. escalate with residual risk + rollback recommendation.

