# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog-style sections with versioned release headings and conventional categories based on the repository history.

## [0.4.0] - 2026-03-08

### Features
- Expanded the hook pipeline with default registry support for mode registration, project memory, learner capture, permission handling, recovery, subagent tracking, pre-compact, session-end, and keyword routing hooks.
- Added first-class execution modes for `autopilot`, `ralph`, and `ultrawork`, each with persisted mode state, verification flow, and learned-skill capture.
- Added `omg ask`, `omg cost`, `omg sessions`, and `omg wait` command surfaces for interactive ask flows, cost tracking, session inspection, and rate-limit waiting.
- Expanded the runtime-loadable skill catalog and resolver/dispatcher behavior, including alias/frontmatter handling and extension fallback lookup.
- Added stop-callback notification plumbing and broader notification summary/tag handling for Slack, Discord, Telegram, generic webhook, and stop-callback flows.

### Changes
- Overhauled the top-level README to better match the current OMG UX, command surface, and positioning.
- Refined extension-facing and runtime prompt surfaces so skills and hooks remain available in extension-first workflows.

## [0.3.1] - 2026-03-08

### Features
- Added an interactive launch path so `omg` and `omg launch` can start Gemini CLI with the OMG extension loaded inside the current tmux pane or in a freshly created tmux session.
- Added `--madmax` launch normalization to expand into `--yolo --sandbox=none` for fast interactive startup.
- Made Docker checks optional in the doctor/verification flow so normal installation and interactive usage do not depend on Docker.

### Changes
- Removed Docker tests from optional CI signals to reduce noise while preserving required validation paths.

## [0.3.0] - 2026-03-08

### Features
- Added lifecycle parity commands for team orchestration: `team status`, `team resume`, `team shutdown`, and `team cancel`.
- Hardened persisted team state, lifecycle metadata, and runtime recovery handling for longer-running tmux-backed executions.
- Filled major OMG MVP Phase 2 and Phase 3 gaps, including stronger control-plane handling, worker coordination, and parity-focused runtime contracts.
- Added CONTRIBUTING guidance and richer usage examples to support operator and contributor workflows.

### Fixes
- Improved state hardening and runtime reliability around lifecycle persistence and recovery-oriented team execution paths.

### Changes
- Continued aligning OMG command behavior and docs with the broader OMC/OMX ecosystem while keeping tmux the default runtime backend.

## [0.2.0] - 2026-03-08

### Features
- Added extension-first packaging with the `extensions/oh-my-gemini/` Gemini extension surface, extension manifest, and architecture docs.
- Hardened tmux team-run and verify contracts, including stronger runtime checks, worker heartbeats, and deterministic failure-path coverage.
- Added setup improvements such as action-status reporting, subagents catalog bootstrap, extension-path discovery, and safer installed-runtime onboarding.
- Added catalog-driven subagent roles, keyword-based task routing, and role-aware coordination planning.
- Added team lifecycle and control-plane hardening, including atomic task pre-assignment, persisted team run requests, resume inputs, and worker done signaling.
- Added state durability features such as shared memory with locks, cross-session sync, handoff support, and stronger persisted schema coverage.
- Added notifications for Slack, Discord, and Telegram.
- Added feature-readiness verification, PRD workflow parsing/validation, MCP server/client modules, built-in tools serving, tool registry, file/exec tools, providers, features facade, HUD overlays, platform abstractions, interop adapters, plugin loading, agent definitions, and OpenClaw/Gemini-adapted runtime modules.
- Added verification tiers and CI-facing verification helpers for `typecheck`, smoke, integration, and reliability bundles.

### Fixes
- Replaced the Docker sandbox path with `sandbox-exec` for Gemini-related execution handling.
- Made Docker full-smoke execution GEMINI_API_KEY-only.
- Fixed OpenClaw unresolved-template handling to fail closed and become repeatable.
- Fixed invalid configuration handling for cross-provider order and numeric environment overrides.
- Hardened installer conflict handling and same-worker task reclaim behavior.

### Changes
- Migrated build and verify flows from pnpm to npm.
- Added packaging gates for consumer/global-install contracts and pre-release npm publishing checks.
- Expanded AGENTS hierarchy, planning docs, operator runbooks, README structure, and architecture/testing docs to reflect the growing surface area.

## [0.1.0] - 2026-02-25

### Features
- Initial release of the OMG TypeScript CLI foundation for Gemini-first orchestration.
- Added the core `omg` command surface with setup, doctor, team-run, and verify foundations.
- Added the tmux-first runtime baseline for launching and coordinating worker sessions.
- Added deterministic state persistence under `.omg/state` as the basis for resumable orchestration.
- Published the initial npm package as `oh-my-gemini-sisyphus` with build, typecheck, test, and verify scripts.

### Changes
- Established the repository structure for `src/`, `tests/`, `scripts/`, `docs/`, and `extensions/` to support extension-first development and verification.
