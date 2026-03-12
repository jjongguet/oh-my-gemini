# Changelog

All notable changes to `oh-my-gemini` are documented in this file.

The format follows a conventional changelog style organized by release and change type, based on the repository's release commits, feature and fix history, and the code present in each release line.

## Release line summary

- `0.1.0` established the initial CLI, tmux runtime foundation, and persisted state model.
- `0.2.0` expanded OMG into an extension-first orchestration platform with setup, lifecycle, tools, MCP, HUD, providers, and control-plane hardening.
- `0.3.0` completed major lifecycle parity work for team orchestration and resumable state.
- `0.3.1` added interactive launch and relaxed Docker assumptions for everyday use.
- `0.4.0` introduced the hook pipeline, execution modes, learned-skill capture, ask/cost/session flows, and richer notifications.
- `0.5.x` exposed all skills as native Gemini CLI slash commands, fixed extension loading, and streamlined CI/CD.

## [0.5.7] - 2026-03-12

### Features
- Exposed all 18 skills as native `/omg:*` slash commands inside Gemini CLI via TOML command files (`commands/omg/*.toml`). Skills like `autopilot`, `plan`, `review`, `verify`, `deep-interview`, and more are now directly accessible without leaving the Gemini prompt.
- Added comprehensive "Slash Commands" section to `README.md` documenting all available `/omg:*` commands organized by category (Workflow, Operational, Utility, Team).

### Fixes
- **Fixed `/omg:*` commands not available in Gemini CLI**: `launch.ts` was passing a filesystem path to `--extensions`, but Gemini CLI expects an extension name. Now reads the `name` field from `gemini-extension.json` and passes `oh-my-gemini` instead (`src/cli/commands/launch.ts`).
- **Fixed extension showing as "disabled" after `omg setup`**: Changed `setup.ts` to use `stdio: 'inherit'` for the `gemini extensions link` call so the user can interact with Gemini CLI's enable prompt. Added explicit `gemini extensions enable` call after successful link (`src/cli/commands/setup.ts`).
- **Fixed `gemini-extension.json` version drift**: Version was stuck at `0.5.5` while `package.json` was `0.5.6`. Gemini CLI reads version from `gemini-extension.json`, not `package.json`. Added `scripts/sync-extension-version.sh` wired into `prepack` to prevent future drift.
- **Fixed CI failure from sync script stdout pollution**: `sync-extension-version.sh` echo output was corrupting `npm pack --json` parsing in `consumer-contract-smoke.sh`. Redirected output to stderr.
- Added `mcp.toml` to doctor `commandFiles` validation array (pre-existing gap).

### CI/CD
- Removed duplicated `pre_release_blocking` job from `release.yml` — release now triggers via `workflow_run` after CI succeeds instead of re-running all tests.
- Trimmed CI from 8 jobs to 5 essential jobs: Lint & Type Check, Global Install Contract, Test (Node 20), Security Audit, PR Validation.
- Added `main-protection` ruleset: PR required, force push blocked, CI checks enforced.

## [0.4.0] - 2026-03-08

### Features
- Expanded the hook system into a full execution pipeline with ordered hook registration, result merging, keyword-based routing, recovery handling, permission handling, pre-compact checkpoints, project-memory capture, learner integration, and subagent tracking (`src/hooks/index.ts`, `src/hooks/*`).
- Added first-class execution modes for `autopilot`, `ralph`, and `ultrawork`, each with persisted mode state, activation hooks, recovery-aware execution, verification gates, and learned-skill recording (`src/modes/autopilot.ts`, `src/modes/ralph.ts`, `src/modes/ultrawork.ts`, `src/lib/mode-state-io.ts`).
- Expanded the skill system and runtime prompt catalog with improved resolution, alias handling, frontmatter metadata parsing, and CLI dispatch through `omg skill` (`src/skills/resolver.ts`, `src/skills/dispatcher.ts`, `src/cli/commands/skill.ts`).
- Added `omg ask`, `omg cost`, `omg sessions`, and `omg wait` command surfaces to support prompting, token and cost visibility, session tracking, and rate-limit wait flows (`src/cli/index.ts`, `src/state/token-tracking.ts`, `src/state/session-registry.ts`).
- Added stop-callback and multi-platform notification delivery plumbing for Slack, Discord, Telegram, generic webhooks, and saved session summaries (`src/notifications/index.ts`, `src/notifications/summary.ts`, `src/notifications/webhook.ts`, `src/notifications/discord.ts`, `src/notifications/telegram.ts`).
- Added learned-skill persistence and project-memory coupling so successful mode runs can feed future worker context and reusable execution patterns (`src/hooks/learner/index.ts`, `src/hooks/project-memory/index.ts`, `src/hooks/context-writer.ts`).

### Fixes
- Hardened stop and recovery behavior around retry-aware flows through bounded recovery decisions and explicit wait-oriented command support (`src/hooks/recovery/index.ts`, `src/cli/commands/wait.ts`).
- Improved mode exclusivity handling so conflicting exclusive modes are skipped instead of overlapping (`src/hooks/mode-registry/index.ts`, `src/hooks/autopilot/index.ts`, `src/hooks/ralph/index.ts`, `src/hooks/ultrawork/index.ts`).

### Documentation
- Overhauled `README.md` to match the current OMG UX, including tmux-first launch, team orchestration, magic keywords, CLI reference, and updated positioning alongside OMC and OMX.

## [0.3.1] - 2026-03-08

### Features
- Added interactive launch as a first-class workflow: `omg` and `omg launch` now start Gemini CLI with the OMG extension loaded either in the current tmux pane or in a fresh tmux session (`src/cli/commands/launch.ts`, `src/cli/index.ts`).
- Added `--madmax` launch expansion to map to `--yolo --sandbox=none` for opt-in aggressive interactive sessions (`src/cli/commands/launch.ts`).
- Made Docker checks optional for standard usage while keeping Docker- and sandbox-oriented contributor workflows available.

### Changes
- Reduced CI reliance on Docker-only signals by removing Docker tests from optional-signal gating while preserving the main validation path.

## [0.3.0] - 2026-03-08

### Features
- Added lifecycle parity for team orchestration with persisted `team status`, `team resume`, `team shutdown`, and `team cancel` flows built around durable run metadata and runtime handles (`src/cli/commands/team-status.ts`, `src/cli/commands/team-resume.ts`, `src/cli/commands/team-shutdown.ts`, `src/cli/commands/team-cancel.ts`).
- Hardened the orchestrator and state layer with canonical phase persistence, run-request snapshots, monitor snapshots, worker status/heartbeat/done signals, and task/mailbox artifacts under `.omg/state/team/<team>/` (`src/team/team-orchestrator.ts`, `src/state/team-state-store.ts`).
- Completed MVP phase 2 and phase 3 gaps by strengthening the tmux runtime, task auditing, worker monitoring, fix-loop handling, and success-checklist evaluation (`src/team/runtime/tmux-backend.ts`, `src/team/monitor.ts`, `src/team/team-orchestrator.ts`).
- Added richer worker lifecycle observability including deterministic task-lifecycle audit logs, control-plane mediated claim/transition/release operations, and improved health reporting (`src/team/control-plane/*`, `src/team/worker-signals.ts`).
- Added contributor-facing documentation for contribution flow and usage examples to support the more complete OMG operator workflow.

### Fixes
- Hardened state durability and lifecycle parity behavior so resume, shutdown, and cancel operate on canonical persisted run metadata instead of ad hoc runtime assumptions.
- Improved worker and task health handling around pre-claiming, fix-loop execution, and status normalization during long-running team runs.

### Documentation
- Added CONTRIBUTING guidance and richer usage examples to reflect the broader command surface and lifecycle model.

## [0.2.0] - 2026-03-08

### Features
- Added project setup management with scoped installation behavior, managed `.gemini` files, Docker sandbox baseline generation, and subagent catalog bootstrap (`src/installer/index.ts`, `src/installer/scopes.ts`).
- Added extension-first packaging as a canonical public surface via `extensions/oh-my-gemini/`, including `gemini-extension.json`, `GEMINI.md`, packaged commands, and packaged skills.
- Added team runtime hardening and a backend abstraction with tmux as the default runtime plus experimental subagents support (`src/team/runtime/*`, `src/team/subagents-catalog.ts`, `src/team/subagents-blueprint.ts`).
- Added lifecycle-oriented team control plane primitives for deterministic task claiming, task transitions, release semantics, mailbox delivery state, and canonical identifiers (`src/team/control-plane/*`).
- Added `omg doctor`, `omg verify`, `omg hud`, `omg mcp serve`, `omg tools`, `omg skill`, `omg prd`, and worker bootstrap command surfaces, expanding OMG from a team runner into a broader operator CLI (`src/cli/index.ts`, `src/cli/commands/*`).
- Added secure file and exec tool registries and built-in MCP tool serving for file, git, HTTP, and process operations (`src/tools/*`, `src/mcp/*`).
- Added shared-memory and state durability for cross-session handoff and resilient writes, including atomic JSON/NDJSON helpers, file locks, and session-aware state paths (`src/state/*`, `src/lib/atomic-write.ts`, `src/lib/file-lock.ts`, `src/lib/worktree-paths.ts`).
- Added provider, config, platform, and interop foundations for Gemini-aware model selection, API clients, shell abstraction, OS detection, and OMG↔OMC/OMX bridge formats (`src/providers/*`, `src/config/*`, `src/platform/*`, `src/interop/*`).
- Added HUD rendering and overlay support for inspecting persisted team state without reading raw state files (`src/hud/*`).
- Added notifications, PRD workflow support, plugin loading, feature-readiness verification, and OpenClaw/provider parity foundations (`src/notifications/*`, `src/prd/*`, `src/plugins/*`, `src/features/index.ts`, `src/openclaw/*`).

### Fixes
- Hardened setup-path conflict detection and fail-closed configuration parsing for invalid numeric overrides and cross-provider ordering.
- Hardened OpenClaw command-template resolution so unresolved template variables fail closed and repeatably.
- Improved same-worker task reclaim idempotency and worker heartbeat reliability during orchestrated runs.
- Fixed provider and test typing issues and CLI dependency wiring for MCP serving.

### Changes
- Migrated build, packaging, and verification flows from pnpm to npm and added consumer/global-install contract gates for publish safety.
- Expanded CI and release coverage with verification gates, OpenClaw smoke coverage, packaging checks, and npm publish automation.
- Refreshed the README, docs tree, AGENTS hierarchy, and operator runbooks to reflect the extension-first OMG workflow.

## [0.1.0] - 2026-02-25

### Features
- Initial public release of the TypeScript CLI package published as `oh-my-gemini-sisyphus` with `omg` and `oh-my-gemini` entrypoints.
- Established the core tmux-based team orchestration foundation for Gemini CLI workflows, including team run execution, worker bootstrapping, doctor/setup basics, and verify/test script wiring.
- Added the first durable state layer under `.omg/state` with JSON and NDJSON persistence helpers, task and worker state storage, and shared-memory handoff support (`src/state/*`).
- Added early MCP server/client support and reusable tool-serving foundations for Gemini-facing integrations (`src/mcp/*`).
- Added the first notification delivery integrations for Slack, Discord, and Telegram (`src/notifications/*`).
- Added initial feature-readiness and verification command support, plus smoke, integration, and reliability test scaffolding (`src/cli/index.ts`, `tests/*`).

### Changes
- Standardized on npm-based build and test flows and introduced the first packaging and install-contract automation around the CLI.
- Began documenting the repository structure, quickstart, and operator guidance that later became the extension-first OMG docs surface.
