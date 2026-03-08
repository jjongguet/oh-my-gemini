# Changelog

All notable changes to `oh-my-gemini` are documented in this file.

The format follows a conventional-commit-oriented changelog, grouped by release and summarized from the repository history and the current codebase.

## [0.4.0] - 2026-03-08

### Features

- Added the `ask`, `cost`, `sessions`, and `wait` CLI flows to support interactive prompting, usage accounting, session inspection, and rate-limit aware waiting behavior.
- Expanded the hook system into an event pipeline with registries for keyword detection, recovery, project memory, learner capture, pre-compact handling, subagent tracking, permission handling, and session-end cleanup/export.
- Added first-class execution modes for `autopilot`, `ralph`, and `ultrawork`, each wrapping team orchestration with persisted mode state and verification-aware completion.
- Introduced stop-callback and notification delivery surfaces for Slack, Discord, Telegram, generic webhooks, and persisted session summaries.
- Expanded the packaged skill surface in both the extension and runtime, including operational prompts such as `ask`, `cost`, `wait`, `sessions`, `configure-notifications`, `learn`, and related workflow helpers.

### Fixes

- Hardened wait/rate-limit handling and session accounting paths so long-running interactive flows can pause and resume more safely.
- Improved hook-driven recovery and compaction behavior so active session metadata is preserved more consistently around session-end and pre-compact events.

### Changes

- Overhauled `README.md` into a fuller product-facing guide with clearer quickstart, team mode, keyword routing, CLI reference, and support sections.
- Broadened the architecture surface from team orchestration alone into a more complete operator platform that includes hooks, learned skills, notifications, and execution modes.

## [0.3.1] - 2026-03-08

### Features

- Added `omg launch` and default interactive launch behavior so `omg` can start Gemini CLI with the OMG extension loaded either inside the current tmux pane or in a new tmux session.
- Added the `--madmax` launch shortcut to expand into `--yolo --sandbox=none` for explicit power-user launch flows.
- Made Docker checks optional for normal workflows while keeping them available for smoke and contributor validation paths.

### Fixes

- Removed Docker-based tests from optional CI signals to reduce false negatives and make the non-Docker path the default expectation for most users.

### Changes

- Positioned interactive launch as a first-class day-to-day entry point alongside team orchestration, doctor, HUD, and verify commands.

## [0.3.0] - 2026-03-08

### Features

- Added lifecycle-parity commands for `omg team status`, `omg team resume`, `omg team shutdown`, and `omg team cancel`, backed by stronger persisted run metadata and resumable state.
- Hardened the team control plane with deterministic task claiming, mailbox/task lifecycle APIs, task audit trails, and stricter persisted state ownership.
- Filled major MVP Phase 2 and Phase 3 gaps across role management, role/skill routing, agent coordination, HUD rendering, provider/model configuration, OpenClaw interoperability, tools integration, and verification contracts.
- Added contributor-facing documentation such as `CONTRIBUTING.md` and expanded usage examples.

### Fixes

- Strengthened state hardening and lifecycle parity paths so orchestration flows fail closed on invalid task transitions and resume inputs.

### Changes

- Elevated OMG from an initial tmux runtime into a broader control plane with stronger parity against the surrounding OMC/OMX ecosystem.
- Expanded project documentation and examples to match the larger command and runtime surface introduced in this release.

## [0.2.0] - 2026-03-08

### Features

- Added the public Gemini extension surface under `extensions/oh-my-gemini/`, including `GEMINI.md`, command templates, packaged skills, and manifest-driven extension metadata.
- Expanded setup/install flows with scope-aware configuration, action-status reporting, managed `.gemini` files, and bootstrap support for subagent catalogs.
- Added catalog-driven subagent selection, role assignment, keyword-driven backend routing, and skill-to-role mapping for team runs.
- Added team lifecycle hardening: worker heartbeat signals, orchestrator pre-assignment, control-plane parity gates, status persistence, and stronger health monitoring.
- Added verification tiers, consumer/global-install contract gates, packaging scripts, feature-readiness checks, and OpenClaw smoke coverage.
- Added HUD rendering, PRD workflow support, MCP server/client modules, built-in tool registries, plugin loading, provider/model configuration, platform abstractions, interop adapters, and shared-memory durability.
- Added notifications for Slack, Discord, and Telegram, plus shared-memory handoff and cross-session sync support.

### Fixes

- Fixed Gemini sandbox handling and Docker smoke flows so sandbox execution and GEMINI_API_KEY-only live smoke checks behave predictably.
- Hardened CLI and team runtime reliability paths, including symlink-safe extension resolution, same-worker task reclaim behavior, invalid config fail-closed handling, and unresolved-template detection in OpenClaw.
- Fixed provider/test integration issues such as missing CLI dependency wiring and strict typing regressions in provider tests.

### Changes

- Migrated build and verification workflows from pnpm-oriented scripts to npm-based scripts and gates.
- Reworked the README, onboarding docs, architecture notes, and operator runbooks to track the expanding OMG surface.
- Added and refreshed AGENTS.md guidance across the repository to document module boundaries and contributor workflows.
- Tightened CI around release blocking, packaging validation, optional signal gating, and GitHub Actions workflow hygiene.
- Hardened installer path-conflict behavior and input validation/security guardrails across runtime-facing surfaces.

## [0.1.0] - 2026-02-25

### Features

- Initial release of `oh-my-gemini` as a TypeScript CLI for Gemini-focused orchestration.
- Added the first core commands: `setup`, `doctor`, `team run`, and `verify`.
- Introduced the team orchestrator, persisted team state store, runtime backend registry, health monitor, and tmux-backed execution as the default runtime path.
- Included an experimental subagents backend contract from the start so runtime behavior could stay backend-driven.
- Added installer primitives for project/user setup scopes and managed file updates.

### Fixes

- No user-facing fixes were recorded before the initial release cut.

### Changes

- Established the foundational repository layout for CLI, installer, state, and team orchestration modules.
- Published the npm package as `oh-my-gemini-sisyphus` with `omg` / `oh-my-gemini` CLI entry points.
