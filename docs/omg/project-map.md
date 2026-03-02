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
| `npm run omg -- <args>` | run CLI from source checkout |
| `npm run gate:consumer-contract` | consumer tarball contract gate |
| `npm run gate:publish` | publish gate (`consumer-contract + gate:3`) |
