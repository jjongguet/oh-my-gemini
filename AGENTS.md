<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-03T07:46:00Z -->

# oh-my-gemini

## Purpose
`oh-my-gemini` is an extension-first orchestration layer for Gemini CLI workflows. It provides a TypeScript CLI (`omg`) with setup/doctor/team-run/verify commands, runtime backends (tmux default + experimental subagents), reliability-focused state persistence, and verification harnesses for smoke/integration/reliability gates.

The package publishes to npm as `oh-my-gemini-sisyphus` (currently v0.1.0). Releasing a new version requires bumping `package.json` version and pushing to `main`; the `release.yml` workflow auto-publishes when the local version differs from the npm registry version.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Project overview, quickstart, command surface, and roadmap status. |
| `package.json` | npm package name (`oh-my-gemini-sisyphus`), version, scripts, CLI bins, and dev dependency definitions. Bump version here to trigger a new npm release. |
| `tsconfig.json` | Strict typechecking config for source + tests. |
| `tsconfig.build.json` | Build-specific emit config for `dist/`. |
| `vitest.config.ts` | Node-based test runner configuration and timeouts. |
| `.gitignore` | Ignores generated artifacts (`dist/`, `.omg/`, `.omx/`, etc.). |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Core implementation (CLI, installer, team orchestration, state). See `src/AGENTS.md`. |
| `src/common/` | Shared utilities used across `src/` modules. Contains `team-name.ts` (shared team naming helpers). |
| `tests/` | Smoke, integration, reliability suites + shared helpers. See `tests/AGENTS.md`. |
| `scripts/` | Bootstrap and automation scripts for setup and verification flows. See `scripts/AGENTS.md`. |
| `docs/` | Architecture, setup, and gate documentation. See `docs/AGENTS.md`. |
| `extensions/` | Gemini extension package and prompt surfaces. See `extensions/AGENTS.md`. |
| `.gemini/` | Managed Gemini local configuration (settings, sandbox baseline, subagent catalog). See `.gemini/AGENTS.md`. |
| `.github/` | CI/CD workflow definitions. See `.github/AGENTS.md`. |
| `.claude/` | Local Claude/MCP settings used by contributors. See `.claude/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Treat `extensions/oh-my-gemini/` as canonical public UX and `src/` as implementation internals.
- Keep runtime defaults aligned with roadmap intent: tmux default backend, subagents opt-in.
- Do **not** hand-edit generated artifacts in `dist/`, `.omg/`, or `.omx/` unless the task is explicitly about generated state behavior.
- Keep code ESM-compatible (`type: module`, NodeNext imports).
- The npm package name is `oh-my-gemini-sisyphus`; the CLI bin names remain `omg` and `oh-my-gemini`.
- To trigger a new npm release: bump `version` in `package.json` and push to `main`. The `release.yml` workflow detects the version difference and publishes automatically.

### Testing Requirements
- Preferred validation sequence for code changes:
  1. `npm run typecheck`
  2. `npm run test` (or targeted suite)
  3. `npm run verify` for command-level gate checks
- For orchestration runtime changes, additionally run `npm run test:reliability`.

### Common Patterns
- Command handlers parse args via shared helpers (`parseCliArgs`, option readers).
- State writes are deterministic and persisted under `.omg/state` using JSON/NDJSON helpers.
- Runtime behavior is backend-driven through the `RuntimeBackend` contract.
- Shared utilities (e.g., team naming) live in `src/common/` and are imported by other `src/` modules.

## Dependencies

### Internal
- `src/cli` orchestrates CLI command dispatch to installer/team/state modules.
- `src/team` depends on `src/state` persistence and runtime backend adapters.
- `src/common` provides shared utilities (team naming, etc.) consumed by `src/team` and other modules.
- Scripts and tests exercise the same CLI entrypoints rather than duplicating orchestration logic.

### External
- Node.js 20+ runtime
- TypeScript + tsx (build/dev execution)
- Vitest (test harness)
- Gemini CLI, tmux, Docker/Podman (runtime prerequisites)

### CI/CD
- `NPM_TOKEN` GitHub secret must be set in repository settings to enable npm publishing via `release.yml`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
