<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# smoke

## Purpose
Fast confidence checks for setup idempotency and sandbox baseline wiring.

## Key Files

| File | Description |
|------|-------------|
| `setup-idempotency.test.ts` | Verifies repeated `setup` runs are stable and dry-run is non-destructive. |
| `sandbox-smoke.test.ts` | Confirms sandbox Dockerfile/script presence and optionally runs live sandbox smoke. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep smoke tests quick and reliable; gate live behavior behind explicit env flags.
- Preserve deterministic assertions around setup action-status output.

### Testing Requirements
- Run `npm run test:smoke` after edits.
- For setup path changes, also run `bash scripts/smoke-install.sh`.

### Common Patterns
- Uses `runIf`/`skipIf` to avoid false negatives when optional tooling is absent.

## Dependencies

### Internal
- Exercises installer flow and sandbox scripts.

### External
- Optional gemini/docker runtime for live smoke (`OMG_RUN_LIVE_SANDBOX_SMOKE=1`).

<!-- MANUAL: -->
