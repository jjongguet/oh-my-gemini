# Project Map

## Top-level structure

| Path | Purpose |
| --- | --- |
| `src/` | TypeScript implementation (`cli`, `installer`, `team`, `state`) |
| `extensions/` | Gemini extension package (`extensions/oh-my-gemini`) |
| `scripts/` | bootstrap/smoke/docker/e2e automation |
| `tests/` | smoke/integration/reliability suites |
| `docs/` | setup, testing, architecture docs |
| `.github/workflows/` | CI + release workflows |

## Key npm scripts

| Script | Purpose |
| --- | --- |
| `npm run setup` | setup with project scope |
| `npm run doctor` | diagnostics |
| `npm run verify` | default verify suites |
| `npm run omg -- prd <subcommand>` | PRD workflow operations (`init/status/next/validate/complete/reopen`) |
| `npm run verify:features` | feature-wise readiness checks + report generation (`--feature`, `--dry-run`) |
| `npm run omg -- <args>` | run CLI from source checkout |
| `npm run gate:consumer-contract` | local consumer tarball contract gate |
| `npm run gate:global-install-contract` | canonical blocking C0 gate (`consumer-contract + global-install-contract`) |
| `npm run gate:publish` | publish gate (`global-install-contract + gate:3`) |
| `npm run build` | TypeScript build |
| `npm run typecheck` | type checking |
| `npm run clean` | remove dist/coverage |
| `npm run test:smoke` | smoke test suite |
| `npm run test:integration` | integration test suite |
| `npm run test:reliability` | reliability test suite |
| `npm run test:all` | all test suites (smoke + integration + reliability) |

## Parity test files

| Path | Coverage |
| --- | --- |
| `tests/reliability/worker-heartbeat.test.ts` | Worker heartbeat signal shape, timestamps, and state-store persistence |
| `tests/reliability/worker-task-claims.test.ts` | Task pre-claim token flow, claim/release transitions, and token mismatch/dependency failures |
| `tests/integration/hook-context-e2e.test.ts` | End-to-end context writer/reader round-trip for `.gemini/GEMINI.md` |
| `tests/integration/skill-runtime-integration.test.ts` | Skill runtime resolution/dispatch and worker-facing skill context integration |
