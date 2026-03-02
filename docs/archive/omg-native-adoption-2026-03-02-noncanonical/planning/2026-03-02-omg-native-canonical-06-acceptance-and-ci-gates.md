# OmG-native Canonical Acceptance Criteria and CI/Release Gates

Date: 2026-03-02  
Canonical ID: C6  
Depends on: C2, C5

---

## 1) Baseline that remains mandatory

Existing gate baseline remains required:

- C0: global install contract
- C1: typecheck/build/smoke/integration/reliability/verify
- C2: publish gate and pre-release blocking

No canonical adoption work may weaken C0/C1/C2.

---

## 2) Acceptance domains (authoritative)

| Domain | What must be true before acceptance |
|---|---|
| AD-A Lifecycle commands | `status/resume/shutdown` behave correctly in JSON+text modes with deterministic exit codes |
| AD-B Control-plane integrity | claim/transition/release semantics are deterministic under conflict/expiry/dependency failures |
| AD-C Worker protocol integrity | workers cannot bypass ACK/claim/report/terminal-state obligations |
| AD-D Role contract integrity | required roles emit schema-valid artifacts and verifier can fail run completion |
| AD-E Docs/UX contract integrity | README/docs/help/extension prompts are synchronized to shipped behavior |
| AD-F Release safety integrity | legacy bypasses and false-green paths are blocked in release gate |

---

## 3) Blocking gate model

### GATE-R1: Lifecycle CLI gate

Scope: AD-A

Required commands:

```bash
npm run typecheck
npm run test:integration -- team-lifecycle
npm run test:reliability -- team-lifecycle
```

Pass criteria:

- lifecycle commands pass contract tests,
- `team run` compatibility is intact,
- invalid invocations preserve usage exit code behavior.

### GATE-R2: Control-plane mutation gate

Scope: AD-B

Required commands:

```bash
npm run test:reliability -- task-lifecycle
npm run test:reliability -- team-state-store
```

Pass criteria:

- deterministic claim conflicts,
- deterministic lease expiry behavior,
- deterministic invalid transition rejection,
- deterministic dependency-blocked claim rejection.

### GATE-R3: Role contract gate

Scope: AD-D

Required commands:

```bash
npm run test:reliability -- subagents
npm run test:integration -- subagents-team-run
```

Pass criteria:

- planner/executor/verifier artifacts satisfy schema,
- verifier failure path blocks completion,
- role assignment mismatch fails with actionable diagnostics.

### GATE-R4: Docs contract gate

Scope: AD-E

Required commands:

```bash
npm run typecheck
npm run verify -- --dry-run --json
```

Plus scripted docs checks for:

- command syntax drift,
- stale flags/examples,
- extension prompt alignment.

Pass criteria:

- no docs/help/prompt drift on lifecycle or role/skill contracts.

### GATE-R5: Release safety gate

Scope: AD-F

Required commands:

```bash
npm run gate:publish
```

Pass criteria:

- legacy bypass usage is auditable and blocked for release,
- no false-green completion path in release evidence,
- full C0/C1/C2 + R1..R4 chain is green.

---

## 4) Phase-to-gate mapping

| Phase | Minimum gate evidence |
|---|---|
| Phase 1 | R2 + C1 green |
| Phase 2 | R1 + R2 + C1 green |
| Phase 3 | R1 + R2 + worker protocol checks + C1 green |
| Phase 4 | R1 + R2 + R3 + R4 green |
| Phase 5 | C0 + C1 + C2 + R1 + R2 + R3 + R4 + R5 green |

---

## 5) Required PR evidence format

Every adoption PR must include:

```text
Verification:
- PASS: <command> (exit=0)
- PASS: <command> (exit=0)
- FAIL: <command> (exit=1) [if any, include root-cause + fix loop]

Compatibility:
- Preserved behavior: <list>
- New behavior gated by: <gate/flag/test>

Risk:
- Known risk IDs touched: <R-xx list>
- Rollback trigger(s): <list>
```

---

## 6) Failure handling policy

If any required gate fails:

1. identify root cause,
2. apply minimal fix,
3. rerun failing gate(s),
4. rerun upstream dependent gates,
5. do not promote phase until all required gates pass.

