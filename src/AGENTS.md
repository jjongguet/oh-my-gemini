<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# src

## Purpose
Primary TypeScript implementation for CLI commands, packaged prompt/skill resolution, runtime orchestration, hooks, verification, notifications, MCP integration, and persisted state management.

## Key Files

| File | Description |
|------|-------------|
| `constants.ts` | Shared repository-level runtime and verification constants. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `agents/` | Agent definitions, prompt metadata, and registry exports (see `agents/AGENTS.md`). |
| `cli/` | CLI entrypoint, command implementations, and CLI-exposed tool server helpers (see `cli/AGENTS.md`). |
| `commands/` | Command-template discovery and expansion helpers (see `commands/AGENTS.md`). |
| `common/` | Shared low-level utilities used across subsystems (see `common/AGENTS.md`). |
| `config/` | Configuration loading, model defaults, and config types (see `config/AGENTS.md`). |
| `features/` | Thin feature facade for commands, config, and platform modules (see `features/AGENTS.md`). |
| `hooks/` | Hook pipeline, mode routing, memory, recovery, and lifecycle helpers (see `hooks/AGENTS.md`). |
| `hud/` | Terminal HUD rendering and state aggregation (see `hud/AGENTS.md`). |
| `installer/` | Setup/install logic and managed-file merge behavior (see `installer/AGENTS.md`). |
| `interop/` | Protocol bridges and format converters between OMG subsystems (see `interop/AGENTS.md`). |
| `lib/` | Foundational atomic write, locking, path, session, and shared-memory primitives (see `lib/AGENTS.md`). |
| `mcp/` | MCP server/client wrappers and OMG MCP types (see `mcp/AGENTS.md`). |
| `modes/` | Autopilot, Ralph, Ultrawork, and shared mode execution helpers (see `modes/AGENTS.md`). |
| `notifications/` | Notification delivery adapters and summary formatting (see `notifications/AGENTS.md`). |
| `openclaw/` | OpenClaw hook wake-up integration helpers (see `openclaw/AGENTS.md`). |
| `platform/` | Cross-platform environment, OS, process, and shell utilities (see `platform/AGENTS.md`). |
| `plugins/` | npm plugin discovery and runtime backend loading (see `plugins/AGENTS.md`). |
| `prd/` | PRD parsing, validation, and workflow helpers (see `prd/AGENTS.md`). |
| `prompts/` | Markdown role prompts used by agents and workers (see `prompts/AGENTS.md`). |
| `providers/` | Gemini provider abstractions and API clients (see `providers/AGENTS.md`). |
| `shared/` | Cross-domain shared types (see `shared/AGENTS.md`). |
| `skills/` | Runtime skill resolver/dispatcher and bundled skill prompt assets (see `skills/AGENTS.md`). |
| `state/` | Filesystem persistence and typed team state storage (see `state/AGENTS.md`). |
| `team/` | Orchestration domain logic, control plane, and runtime backends (see `team/AGENTS.md`). |
| `tools/` | OMG tool registry plus Gemini/MCP adapters (see `tools/AGENTS.md`). |
| `utils/` | Security-focused utility helpers (see `utils/AGENTS.md`). |
| `verification/` | Verification-tier selection, suite execution, and report assertions (see `verification/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Maintain strict TypeScript types, Node ESM import conventions, and deterministic runtime behavior.
- Keep public UX boundaries clear: packaged prompts/skills stay in asset folders, while implementation belongs in the corresponding TypeScript subsystems.
- Prefer extending shared utilities in `lib/`, `common/`, `state/`, `tools/`, or `platform/` instead of duplicating low-level logic.

### Testing Requirements
- Minimum validation for code changes is `npm run typecheck` plus the most relevant targeted tests.
- For runtime, hook, state, or orchestration changes, run `npm run test:reliability` and the affected integration suites.

### Common Patterns
- Implementation modules are organized by subsystem with thin facade directories such as `features/`, `commands/`, and `shared/`.
- Runtime state and control-plane invariants flow through `state/`, `team/`, and `lib/` rather than ad hoc file or process handling.
- Prompt/skill content is separated from execution logic for clarity and packaging.

## Dependencies

### Internal
- `cli/` dispatches into installer, team, tool, skill, notification, PRD, and verification modules.
- `hooks/`, `modes/`, `team/`, and `state/` cooperate to manage runtime orchestration and persisted state.
- `providers/`, `mcp/`, `tools/`, and `plugins/` integrate external systems through typed boundaries.

### External
- Node core modules for filesystem, process, crypto, and networking utilities.
- `@modelcontextprotocol/sdk` for MCP support.

<!-- MANUAL: -->
