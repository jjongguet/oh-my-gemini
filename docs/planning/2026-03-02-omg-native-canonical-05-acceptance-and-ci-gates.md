# OMP-Native Canonical 05 — Acceptance Criteria and CI Gates

Status: **Canonical (authoritative)**  
Date: 2026-03-02

## 1) Gate model (resolved)

Existing gates remain mandatory:

- **C0** install contract
- **C1** quality baseline (typecheck/build/smoke/integration/reliability/verify)
- **C2** publish gate

Adoption gates added:

- **C3** control-plane mutation integrity
- **C4** lifecycle CLI contract
- **C5** worker protocol contract
- **C6** role/skill evidence contract
- **C7** docs/deprecation contract

## 2) Acceptance criteria by domain

| Domain | Must-pass criteria |
|---|---|
| Lifecycle CLI | status/resume/shutdown support JSON + actionable failure semantics |
| Control-plane | claim/transition/release are deterministic and reject illegal transitions |
| Worker protocol | ACK/claim/evidence/idle order enforced with explicit failure reasons |
| Role/skill | planner/executor/verifier artifacts are schema-valid and discoverable |
| Docs contract | README/docs/help/extension prompts match real command contracts |
| Release safety | baseline release path does not require legacy bypass toggles |

## 3) Required verification bundle

Minimum bundle for adoption PRs:

```bash
npm run typecheck
npm run lint
npm run test:smoke
npm run test:integration
npm run test:reliability
npm run verify
```

Lifecycle command bundle (when Phase 2 is active):

```bash
npm run omp -- team status --help
npm run omp -- team resume --help
npm run omp -- team shutdown --help
```

## 4) Evidence format (required in PR/task completion)

```text
Verification:
- PASS|FAIL: <command> (exit=<code>)
- PASS|FAIL: <command> (exit=<code>)

Compatibility:
- Preserved: <legacy behavior list>
- New contract: <new behavior list>
- Legacy-toggle usage: <none|required and why>
```

## 5) Blocking policy

- C3/C4/C5 move to blocking before default-on rollout.
- C6 becomes blocking before strict role-contract enforcement.
- C7 becomes blocking before GA/deprecation completion.
