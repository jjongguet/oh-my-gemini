# OmG-native Canonical 06 — Acceptance, CI Gates, and Verification Contract (Worker 4)

Date: 2026-03-02  
Status: **Canonical**  
Depends on: C1, C2, C3, C5

## 1) Gate taxonomy (authoritative)

- **C0** Global install contract (existing, blocking)
- **C1** Quality baseline (existing, blocking)
- **C2** Publish gate (existing, blocking for release)
- **C3** Lifecycle operator parity gate (new, blocking from Phase 2)
- **C4** Control-plane mutation integrity gate (new, blocking from Phase 1)
- **C5** Role/skill evidence integrity gate (new, blocking from Phase 4)
- **C6** Docs/help contract gate (new, initially non-blocking then blocking)
- **C7** Rollout/deprecation safety gate (new, blocking before Ring 2)

## 2) Gate definitions

## C0 / C1 / C2 (baseline preservation)

Keep existing `docs/testing/gates.md` behavior and strictness unchanged.

## C3 — Lifecycle operator parity

Required evidence:

- `omg team status` integration coverage,
- `omg team resume` recovery coverage,
- `omg team shutdown` graceful + force coverage,
- JSON and human output contract checks.

Fail if any lifecycle command is missing, undocumented, or untested.

## C4 — Control-plane mutation integrity

Required evidence:

- claim/transition/release conflict tests,
- invalid transition rejection tests,
- no direct lifecycle overwrite path in new runtime code.

Fail if task lifecycle can bypass claim-token semantics.

## C5 — Role/skill evidence integrity

Required evidence:

- role contract v1 schema checks for `planner`,`executor`,`verifier`,
- deterministic artifact path assertions,
- completion truth checks require role evidence.

Fail if completion can occur without required role artifacts.

## C6 — Docs/help contract

Required evidence:

- CLI help output and docs command sections are aligned,
- phase/gate terminology matches C1..C7 canonical docs,
- deprecated docs are not referenced as authoritative in new planning materials.

Fail on command or policy drift between docs and runtime surface.

## C7 — Rollout/deprecation safety

Required evidence:

- legacy bypass flags are not required for baseline pass,
- rollout ring criteria met before promotion,
- rollback playbook validated for current ring.

Fail if release progression depends on compatibility-only behavior.

## 3) Verification command pack (PR minimum)

For implementation PRs in this program, include command evidence for:

```bash
npm run typecheck
npm run test
npm run lint
npm run verify
```

If `npm run test` is too broad for a scoped change, include targeted suite evidence plus a rationale and at least one regression-focused suite.

## 4) PASS/FAIL reporting format (required)

Every execution report should include:

- `Verification:` header
- per check: `PASS` or `FAIL`
- command used
- short output summary (or log path)
- if FAIL: root cause + fix iteration status

## 5) Fix-verify loop policy

If a required check fails:

1. diagnose root cause,
2. apply minimal fix,
3. rerun failing checks,
4. repeat up to 3 cycles,
5. escalate with failed checks, attempted fixes, and next-step recommendation.

## 6) Gate promotion policy

- Rings 0-1: C6 can be non-blocking while stabilizing docs automation.
- Ring 2: C6 becomes blocking; C7 required.
- Ring 3/GA: all C0..C7 blocking for release-bound changes in this scope.
