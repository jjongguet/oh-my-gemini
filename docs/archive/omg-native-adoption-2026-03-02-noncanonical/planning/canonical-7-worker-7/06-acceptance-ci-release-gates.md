# C6 — Acceptance, CI, and Release Gates

## 1) Gate policy

Keep existing OmG quality baseline and add parity-specific gates.  
No parity claim is valid without machine-verifiable gate evidence.

## 2) Gate matrix (canonical)

| Gate ID | Focus | Blocking stage | Minimum evidence |
|---|---|---|---|
| G0 | Existing OmG baseline gates (typecheck/tests/verify) | Always | baseline scripts green |
| G1 | Lifecycle CLI contract (`run/status/resume/shutdown`) | Ring 1+ | command integration tests |
| G2 | Control-plane mutation integrity (claim/transition/release) | Ring 1+ | reliability suite green |
| G3 | Worker protocol enforcement (ACK->claim->result->idle) | Ring 2+ | tmux integration/e2e evidence |
| G4 | Role/skill artifact schema integrity | Ring 2+ | schema validation + verifier output |
| G5 | Docs/command parity (operator surface matches reality) | Ring 2+ | docs contract checks |
| G6 | Reliability + restart/resume truthfulness | Ring 3 (GA) | deterministic repeated-run evidence |
| G7 | Unsafe legacy bypass prohibition | Ring 3 (GA) | release pipeline hard-fail when bypass detected |

## 3) Acceptance checklist (must-pass)

1. lifecycle commands behave deterministically for existing and missing teams
2. illegal task transitions are rejected with typed errors
3. claim conflicts and lease expiry paths are deterministic
4. worker cannot execute mutable task without successful claim
5. verifier evidence exists for completion and regression checks
6. status output and stored state remain consistent after interruption/resume

## 4) Standard verification command pack

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run verify`
- `npm run team:e2e` (or deterministic team integration equivalent)

## 5) PR evidence template (required)

```md
Verification:
- PASS/FAIL: typecheck (command + key output)
- PASS/FAIL: tests (command + key output)
- PASS/FAIL: lint (command + key output)
- PASS/FAIL: e2e/integration behavior (command + key output)
- PASS/FAIL: regression checks (what was checked)
```

## 6) Regression policy

Any failure in G1..G7:
- blocks promotion to next ring,
- requires root-cause + fix + re-run evidence,
- may trigger rollback if in higher ring.

