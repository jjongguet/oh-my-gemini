# OmG-Native Risk Register, Rollout Strategy, and Ralplan-Ready Task Decomposition

Date: 2026-03-02  
Purpose: operational risk plan and execution backlog for OmG-native adoption.

---

## 1) Risk Register

| Risk ID | Risk | Likelihood | Impact | Early Signal | Mitigation | Owner Suggestion |
|---|---|---:|---:|---|---|---|
| R-01 | False-green due to legacy bypass flags (`OMG_LEGACY_*`) | M | H | verify/runtime passes when explicit baseline absent | gate and log legacy paths; block in release jobs | reliability owner |
| R-02 | Task lifecycle race/conflict produces non-deterministic outcomes | M | H | flaky claim/transition tests | enforce claim token + lease semantics + serialized writes | control-plane owner |
| R-03 | State schema changes break existing readers/scripts | M | H | integration/e2e scripts fail on new fields | additive schema only, compatibility read tests, migration notes | state owner |
| R-04 | Lifecycle CLI added but docs/extension prompts drift | H | M | user reports “command not found” from docs examples | docs contract checks in CI, synchronized update checklist | docs owner |
| R-05 | Role contracts become nominal and not evidence-driven | M | H | role runs complete without usable artifacts | enforce artifact schema validation and verifier gate | role-contract owner |
| R-06 | Subagents backend promises exceed runtime reality | M | M | feature claims outpace deterministic behavior | phase rollout: deterministic artifacts first, live delegation later | runtime owner |
| R-07 | Increased command surface raises UX complexity | M | M | onboarding confusion/support load | keep CLI minimal; use extension-first guidance | product/docs owner |
| R-08 | tmux runtime stability regressions during control-plane integration | L-M | H | flaky team run or cleanup failures | isolate transport layer responsibilities; add live e2e smoke | runtime owner |
| R-09 | CI duration inflation causes slow delivery loop | M | M | queue time and PR turnaround increase | targeted suites + staged gating strategy | infra owner |
| R-10 | Cross-repo parity chasing causes OmG identity dilution | M | M | OmG UX becomes copy of OmX conventions | enforce OmG-native principles in design review checklist | architecture owner |

---

## 2) Rollout Strategy

## Stage 0 — Internal Design Freeze

- lock contracts for lifecycle + role artifacts
- no user-visible changes yet
- verify with dry-run paths and internal tests

## Stage 1 — Canary (opt-in)

- enable new lifecycle commands + control-plane semantics behind explicit feature toggle (if needed)
- use internal contributors and controlled repos
- collect failure reason telemetry and migration friction

### Canary Exit Criteria

- zero high-severity regressions for 7 consecutive days
- deterministic claim/transition reliability suite green in CI
- docs contract checks passing for changed command surfaces

## Stage 2 — Beta (default-on for repository contributors)

- lifecycle commands documented as standard operator path
- role contracts (planner/executor/verifier) active for subagents workflows
- maintain rollback flag/path for one release cycle

### Beta Exit Criteria

- two release cycles with no data-loss/state corruption issues
- stable integration tests for lifecycle + role contracts
- live-team operator runbook validated at least twice

## Stage 3 — GA

- remove or hard-block unsafe legacy compatibility bypasses in release pipeline
- treat role contract checks as standard quality baseline
- publish migration and troubleshooting notes

### GA Exit Criteria

- C0/C1/C2 + new lifecycle/role gates all green
- no unresolved P0/P1 issues in adoption backlog
- release notes include migration caveats and rollback policy

---

## 3) Rollback Strategy

If canary/beta detects severe issues:

1. disable new behavior via feature toggle or command path fallback
2. keep existing `team run` baseline available
3. preserve state readability (do not remove new fields abruptly)
4. publish incident summary and adjusted guardrail tests before reattempt

Rollback trigger examples:

- unrecoverable state corruption,
- non-deterministic task ownership bugs,
- repeated operator inability to shutdown/resume safely.

---

## 4) Ralplan-Ready Task Decomposition

The following tasks are structured to be directly translatable into team tasks (`subject`, `description`, `blocked_by`, acceptance evidence).

## Phase A — Control-plane foundation

### T-A1

- **Subject:** Define team/task contracts for OmG control-plane
- **Description:** Add explicit contract constants for team/task IDs, task status transitions, and failure reason codes.
- **Blocked by:** none
- **Requires code change:** yes
- **Acceptance evidence:** reliability tests for contract validation and illegal transition rejection.

### T-A2

- **Subject:** Implement claim/transition/release task lifecycle APIs
- **Description:** Build lifecycle-safe task mutation helpers and integrate with state store.
- **Blocked by:** T-A1
- **Requires code change:** yes
- **Acceptance evidence:** deterministic tests for claim conflict, lease expiry, and CAS mismatch.

### T-A3

- **Subject:** Add mailbox delivery lifecycle helpers
- **Description:** Ensure notified/delivered state transitions are explicit and testable.
- **Blocked by:** T-A1
- **Requires code change:** yes
- **Acceptance evidence:** reliability tests for mailbox list/mark-delivered/no-duplicate behavior.

## Phase B — Lifecycle CLI parity

### T-B1

- **Subject:** Add `omg team status` command
- **Description:** Report team phase, worker health, task summary, and snapshot metadata.
- **Blocked by:** T-A2
- **Requires code change:** yes
- **Acceptance evidence:** unit + integration command tests, docs updates.

### T-B2

- **Subject:** Add `omg team resume` command
- **Description:** Resume team lifecycle from durable state with actionable diagnostics on failure.
- **Blocked by:** T-A2
- **Requires code change:** yes
- **Acceptance evidence:** integration test for resumable and non-resumable scenarios.

### T-B3

- **Subject:** Add `omg team shutdown` command
- **Description:** Support graceful and forced shutdown paths with consistent state updates.
- **Blocked by:** T-A2
- **Requires code change:** yes
- **Acceptance evidence:** integration + live smoke evidence for cleanup and force fallback.

## Phase C — Role contract execution

### T-C1

- **Subject:** Define planner/executor/verifier artifact schema
- **Description:** Specify required artifact fields and locations under `.omg/state/team/<team>/artifacts`.
- **Blocked by:** T-A1
- **Requires code change:** docs + schema checks
- **Acceptance evidence:** schema contract tests and docs publication.

### T-C2

- **Subject:** Wire subagents runtime to emit role artifacts
- **Description:** Ensure selected roles generate deterministic contract-bound artifacts.
- **Blocked by:** T-C1
- **Requires code change:** yes
- **Acceptance evidence:** reliability tests verifying required artifact fields.

### T-C3

- **Subject:** Enforce verifier gate from role artifact outcomes
- **Description:** Integrate verifier artifact PASS/FAIL into orchestrator success checklist.
- **Blocked by:** T-C2
- **Requires code change:** yes
- **Acceptance evidence:** failure-path tests proving run failure on verifier contract failure.

## Phase D — Extension skill and UX alignment

### T-D1

- **Subject:** Add OmG extension skills for team/review/verify/handoff
- **Description:** Expand extension skill surface and map each to runtime/contract evidence paths.
- **Blocked by:** T-C1
- **Requires code change:** yes (extension docs/prompts)
- **Acceptance evidence:** extension skill smoke checks and docs alignment checks.

### T-D2

- **Subject:** Synchronize docs/help/prompts for new lifecycle surface
- **Description:** Ensure README, docs, CLI help, and extension prompts use the same command contract.
- **Blocked by:** T-B1, T-B2, T-B3, T-D1
- **Requires code change:** docs
- **Acceptance evidence:** docs contract checks in CI (or scripted local gate).

## Phase E — Hardening and rollout

### T-E1

- **Subject:** Gate or retire legacy compatibility bypasses
- **Description:** prevent release-time false-green due to legacy env toggles.
- **Blocked by:** T-B3, T-C3
- **Requires code change:** yes
- **Acceptance evidence:** CI fails when bypass mode is active in blocking jobs.

### T-E2

- **Subject:** Add canary/beta/GA rollout playbook and rollback checklist
- **Description:** operationalize staged release and rollback triggers.
- **Blocked by:** T-E1
- **Requires code change:** docs/workflow config
- **Acceptance evidence:** release docs + workflow updates + operator runbook examples.

---

## 5) JSON-like Task Payload Template (for team systems)

```json
{
  "id": "A2",
  "subject": "Implement claim/transition/release task lifecycle APIs",
  "description": "Build lifecycle-safe task mutation helpers and integrate with state store.",
  "blocked_by": ["A1"],
  "requires_code_change": true,
  "acceptance": [
    "deterministic claim conflict behavior",
    "lease-expiry rejection behavior",
    "CAS mismatch behavior"
  ],
  "verification": [
    "npm run typecheck",
    "npm run test:reliability",
    "npm run verify -- --json"
  ]
}
```

Use the same structure for B1–E2 tasks.
