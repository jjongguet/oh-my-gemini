# OmG-native Canonical C6 — Acceptance Criteria and CI Gates

Date: 2026-03-02  
Status: Authoritative

---

## 1) Baseline gates to preserve

Keep current blocking baseline:

- **C0:** global install contract
- **C1:** typecheck/build/smoke/integration/reliability/verify baseline
- **C2:** publish gate

---

## 2) New blocking adoption gates

| Gate | Scope | Blocking criteria |
|---|---|---|
| C3-control-plane | claim/transition/release/mailbox lifecycle | negative paths deterministic; lifecycle bypass paths rejected |
| C4-lifecycle-cli | `team status/resume/shutdown` behavior | command output/exit-code/error contracts stable in integration tests |
| C5-worker-protocol | ACK/claim/evidence/idle enforcement | protocol violations fail deterministically with reason codes |
| C6-role-skill-contract | role schema + skill mapping | required artifacts present and schema-valid for planner/executor/verifier |
| C7-docs-contract-and-governance | docs/help/prompt alignment + legacy policy | command docs match CLI, and release fails if legacy bypass is required |

---

## 3) Acceptance criteria by domain

### Domain A — Lifecycle commands

1. valid invocation works in text and JSON mode,
2. invalid args return usage/config exit (`2`),
3. runtime errors return exit `1` with actionable reason,
4. status output includes phase/task/worker health summary.

### Domain B — Task lifecycle safety

1. only legal transitions are accepted,
2. claim contention and stale lease handling are deterministic,
3. claim token required for lifecycle transitions,
4. new code does not mutate lifecycle fields via raw write paths.

### Domain C — Worker protocol integrity

1. worker without claim cannot execute assigned task,
2. completion without evidence is rejected,
3. terminal worker state writes (`idle`/`blocked`) are explicit and auditable.

### Domain D — Role/skill integrity

1. planner/executor/verifier outputs follow schema v1,
2. skill invocation contract maps to deterministic artifact paths,
3. verifier output can fail team run deterministically.

### Domain E — Docs/UX integrity

1. README, docs, CLI help, extension prompts agree,
2. no stale/removed command examples,
3. runbook reflects real lifecycle behavior.

---

## 4) Required evidence command bundle

```bash
npm run typecheck
npm run lint
npm run test
npm run test:reliability
npm run verify -- --json
```

When lifecycle commands land, also require:

```bash
npm run omg -- team status --team <team> --json
npm run omg -- team resume --team <team> --json
npm run omg -- team shutdown --team <team> --force --json
```

---

## 5) PR evidence format (mandatory)

```text
Verification:
- PASS: <command> (exit=0)
- FAIL: <command> (exit=1) <reason/next action>

Compatibility:
- Preserved: <legacy behavior list>
- New gates: <C3..C7 evidence>
```
