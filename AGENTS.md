<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# oh-my-gemini

## Purpose
`oh-my-gemini` is an extension-first orchestration layer for Gemini CLI workflows. The repository ships the `omg` / `oh-my-gemini` CLI, Gemini extension command assets, reusable skills, runtime orchestration modules, and verification harnesses for smoke, integration, reliability, and live e2e flows.

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Primary project overview, quickstart, and command surface. |
| `package.json` | npm package metadata, CLI bins, scripts, and release version that drives npm publishing. |
| `gemini-extension.json` | Extension manifest that exposes packaged commands and assets to Gemini. |
| `tsconfig.json` | Strict TypeScript configuration for source and tests. |
| `vitest.config.ts` | Vitest runner configuration for repository test suites. |
| `REPOSITORY_STRUCTURE.md` | Human-readable snapshot of the repository layout and subsystem roles. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Packaged Gemini extension command prompts and prompt bundles (see `commands/AGENTS.md`). |
| `docs/` | Canonical architecture, planning, setup, testing, examples, and archive documentation (see `docs/AGENTS.md`). |
| `scripts/` | Bootstrap, smoke, integration, Docker, and live team-run automation (see `scripts/AGENTS.md`). |
| `skills/` | Extension-facing reusable skill prompts shipped with the package (see `skills/AGENTS.md`). |
| `src/` | TypeScript implementation for CLI commands, runtimes, hooks, skills, tools, and state handling (see `src/AGENTS.md`). |
| `tests/` | Smoke, integration, reliability, utils, and e2e verification suites (see `tests/AGENTS.md`). |
| `.gemini/` | Managed Gemini-local configuration and bundled subagent catalog (see `.gemini/AGENTS.md`). |
| `.github/` | GitHub automation and release workflows (see `.github/AGENTS.md`). |
| `.claude/` | Local Claude/MCP contributor settings for this repository (see `.claude/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Treat `gemini-extension.json`, `commands/`, and `skills/` as the canonical packaged UX; keep them synchronized with the CLI behavior implemented under `src/`.
- Keep runtime defaults aligned with current product direction: tmux is the default backend and subagents remain explicit opt-in unless code and docs change together.
- Do not hand-edit generated or runtime-state artifacts under `dist/`, `.omg/`, `.omx/`, or `.omc/` unless the task is explicitly about generated-state behavior.
- Keep repository code ESM-compatible (`type: module`, NodeNext-style imports) and preserve the published package/bin names declared in `package.json`.
- Bumping `version` in `package.json` is what triggers npm release publication through `.github/workflows/release.yml` when changes land on `main`.

### Testing Requirements
- Preferred validation sequence for code changes: `npm run typecheck`, relevant `npm run test:*` suites (or `npm run test`), then `npm run verify`.
- For orchestration, hook, backend, or persistence changes, also run `npm run test:reliability`.
- For user-facing command, packaging, or extension asset changes, validate the referenced commands, packaged files, and docs examples together.

### Common Patterns
- Public prompt assets live under `commands/` and `skills/`; implementation lives under `src/`.
- Runtime persistence is rooted under `.omg/state` through shared filesystem/state helpers rather than ad hoc file writes.
- Documentation is organized by concern (`architecture`, `analysis`, `planning`, `setup`, `testing`, `examples`) and archive material is isolated under `docs/archive/`.

## Dependencies

### Internal
- `src/cli` dispatches the CLI into installer, team, tool, skill, and verification modules.
- `commands/` and `skills/` mirror the public extension surface that is packaged from repository assets.
- `scripts/` and `tests/` exercise the same public commands instead of reimplementing orchestration logic separately.

### External
- Node.js 20+ runtime.
- TypeScript + tsx for build/dev execution.
- Vitest for test orchestration.
- Gemini CLI, tmux, and Docker/Podman for setup, runtime, and smoke/e2e flows.
- `@modelcontextprotocol/sdk` for MCP server/client integration.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
