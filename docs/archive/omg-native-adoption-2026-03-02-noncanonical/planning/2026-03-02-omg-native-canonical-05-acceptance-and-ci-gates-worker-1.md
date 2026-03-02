# Canonical 05 — OmG-native Acceptance Criteria and CI Gates (Worker 1)

Date: 2026-03-02  
Status: Final canonical draft (worker-1)

## 1) Baseline Gates to Preserve

Existing baseline remains mandatory:

- C0 global install contract
- C1 quality pipeline (typecheck/build/test/verify)
- C2 publish/release blocking gate

## 2) New Acceptance Domains (Authoritative)

## AD-A Lifecycle command correctness

Applies to: `team status`, `team resume`, `team shutdown`.

Must-pass:

1. deterministic success output (text + JSON)
2. invalid usage exits with code `2`
3. runtime failure exits with code `1`
4. output includes phase/task/worker health summary

## AD-B Task lifecycle mutation safety

Must-pass:

1. legal transition enforcement
2. deterministic claim conflict behavior
3. deterministic stale lease rejection
4. explicit CAS/version mismatch errors
5. no new direct lifecycle overwrite path

## AD-C Role contract integrity

Must-pass:

1. required artifact fields per role
2. deterministic artifact location
3. verifier can fail run based on evidence mismatch
4. role-tag parsing consistency

## AD-D Docs/UX contract

Must-pass:

1. README/docs/help/extension prompts use same command contract
2. stale examples removed
3. runbook matches real lifecycle behavior

## 3) Canonical New Gates

## R1 Lifecycle CLI gate (blocking from phase 2)

Required checks:

- lifecycle integration tests
- command parsing/error semantics
- no regression on `team run`

## R2 Control-plane mutation gate (blocking from phase 1)

Required checks:

- claim conflict
- lease expiry
- illegal transition rejection
- blocked dependency enforcement
- release/recovery behavior

## R3 Role contract gate (blocking from phase 4)

Required checks:

- planner/executor/verifier artifact schema validation
- role-selection mismatch failure behavior
- verifier contract influence on terminal status

## R4 Docs contract gate (non-blocking first, blocking by phase 5)

Required checks:

- docs command string consistency
- extension prompt command consistency
- no drift against CLI help output

## 4) Minimum Verification Bundle for Adoption PRs

```text
Verification:
- PASS/FAIL: npm run typecheck
- PASS/FAIL: npm run test
- PASS/FAIL: npm run lint
- PASS/FAIL: npm run verify
```

Include command output references and compatibility notes.

## 5) Release Blocking Policy

Release MUST fail if any are true:

- lifecycle/role gates red,
- legacy bypass enabled in blocking jobs,
- docs/CLI contract drift detected,
- completion can be marked without required evidence.
