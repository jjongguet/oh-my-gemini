# Architecture Boundaries (MVP)

This document defines implementation boundaries for the phased roadmap.

## A. Extension Surface (public)
Path: `extensions/oh-my-gemini/**`

Responsibilities:
- Public command/skill entry points for Gemini users
- Context instructions for extension-driven workflows

Must not contain:
- Core runtime orchestration logic
- Persistent state machine internals

## B. Core Application Services (internal)
Paths:
- `src/cli/**`
- `src/installer/**`
- `src/team/**`
- `src/state/**`

Responsibilities:
- Setup/doctor/team-run/verify use cases
- Deterministic, testable orchestration behavior

## C. Runtime Adapter Layer (internal)
Path: `src/team/runtime/**`

Responsibilities:
- Runtime backend contract (`RuntimeBackend`)
- Default tmux backend implementation
- Optional subagent backend integration (experimental opt-in)

## D. State & Observability (internal)
Paths: `src/state/**`, `.omg/state/**`

Responsibilities:
- Persist phase transitions and status
- Record heartbeat/snapshot signals for reliability checks

## E. Verification Harness
Paths: `scripts/**`, `tests/**`

Responsibilities:
- Smoke/integration/reliability validation commands
- Gate enforcement for CI and local development
