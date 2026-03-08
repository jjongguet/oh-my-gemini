# OMG Architecture

`oh-my-gemini` is an extension-first orchestration layer for Gemini CLI workflows. At runtime it combines:

- a TypeScript CLI entry point,
- a hook pipeline that can reroute work into execution modes,
- a tmux-first team orchestrator with a deterministic control plane,
- persistent state under `.omg/state`,
- reusable skill and extension assets under `extensions/oh-my-gemini/`, and
- optional notification, MCP, and tooling surfaces.

This document summarizes how those pieces fit together in the current codebase.

## Architecture at a glance

| Concern | Primary modules | What they own |
| ------- | --------------- | ------------- |
| CLI surface | `src/cli/`, `src/commands/` | command parsing, dispatch, extension command templates |
| Hooks and modes | `src/hooks/`, `src/modes/`, `src/lib/mode-*` | prompt routing, guardrails, recovery, mode state, learned execution |
| Team orchestration | `src/team/`, `src/team/runtime/`, `src/team/control-plane/` | backend startup, worker lifecycle, deterministic task and mailbox transitions |
| Durable state | `src/state/`, `src/lib/atomic-write.ts`, `src/lib/file-lock.ts` | persisted JSON/NDJSON artifacts, audit trails, session and token records |
| Extension and skills | `extensions/oh-my-gemini/`, `src/skills/`, `src/installer/` | public Gemini UX, packaged prompts, packaged skills, setup wiring |
| Notifications and tools | `src/notifications/`, `src/mcp/`, `src/tools/` | outbound delivery, MCP server/client, built-in tool registry |

---

## High-level flow

```text
┌──────────────┐
│ User / CI    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│ CLI entrypoint               │
│ src/cli/index.ts             │
└──────┬───────────────────────┘
       │ resolves command / default launch
       ├──────────────────────────────────────────────┐
       │                                              │
       ▼                                              ▼
┌────────────────────────┐                ┌─────────────────────────┐
│ Interactive launch     │                │ Team / worker commands  │
│ gemini --extensions    │                │ doctor/verify/skill/etc │
│ src/cli/commands/*     │                │ src/cli/commands/*      │
└─────────┬──────────────┘                └──────────┬──────────────┘
          │                                          │
          │                               reads/writes state,
          │                               context, skills,
          │                               notifications
          │                                          │
          │                                          ▼
          │                            ┌─────────────────────────────┐
          │                            │ Hook pipeline               │
          │                            │ src/hooks/index.ts          │
          │                            └──────────┬──────────────────┘
          │                                       │ may activate mode
          │                                       ▼
          │                            ┌─────────────────────────────┐
          │                            │ Execution modes             │
          │                            │ autopilot / ralph /         │
          │                            │ ultrawork                   │
          │                            └──────────┬──────────────────┘
          │                                       │ delegates to
          │                                       ▼
          │                            ┌─────────────────────────────┐
          │                            │ TeamOrchestrator            │
          │                            │ src/team/team-orchestrator.ts│
          │                            └──────────┬──────────────────┘
          │                                       │
          │                      ┌────────────────┴────────────────┐
          │                      ▼                                 ▼
          │         ┌────────────────────────┐      ┌──────────────────────────┐
          │         │ Runtime backend        │      │ Control plane + state    │
          │         │ tmux / subagents       │      │ tasks/mailbox/workers    │
          │         │ src/team/runtime/*     │      │ src/team/control-plane/* │
          │         └───────────┬────────────┘      │ src/state/*              │
          │                     │                   └──────────┬───────────────┘
          │                     ▼                              │
          │         ┌────────────────────────┐                │
          └────────►│ Worker sessions        │◄───────────────┘
                    │ omg worker run         │ heartbeats, done signals,
                    │ or gemini -p           │ task transitions, snapshots
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Extension + skills     │
                    │ extensions/oh-my-gemini│
                    └────────────────────────┘
```

---

## 1) CLI entry point and command dispatch

### Primary entry point

The CLI starts in [`src/cli/index.ts`](../src/cli/index.ts).

Key responsibilities:

- load package metadata for version/help output,
- resolve whether the invocation is a subcommand or an implicit `launch`,
- dispatch to focused handlers under `src/cli/commands/`,
- provide injectable dependencies for testing command handlers.

### Command surface

The main dispatch layer currently wires commands for:

- launch/setup/update/uninstall/doctor,
- `team run|status|resume|shutdown|cancel`,
- `worker run`,
- skill/tools/prd/hud/mcp,
- verify/ask/cost/sessions/wait.

The command template helper in [`src/commands/index.ts`](../src/commands/index.ts) resolves packaged TOML command prompts from the extension directory and expands command arguments. That keeps extension-defined prompts discoverable without hardcoding every prompt into the CLI binary.

### Interactive launch path

[`src/cli/commands/launch.ts`](../src/cli/commands/launch.ts) is the default "start Gemini with OMG loaded" path.

It:

- resolves the extension path,
- decides whether to run inside the current tmux pane or in a new tmux session,
- normalizes launch flags,
- expands `--madmax` into `--yolo --sandbox=none`,
- runs `gemini --extensions <extensionPath> ...`.

This is the core reason OMG feels extension-first even though the implementation is a TypeScript CLI.

---

## 2) Hook system pipeline

The hook system lives in [`src/hooks/index.ts`](../src/hooks/index.ts).

### Core pipeline

The hook system is built around three core pieces:

- `RegisteredHook`: declares `name`, `events`, `priority`, and `handler`
- `runHookPipeline()`: filters hooks by event and runs them in priority order
- `mergeHookResults()`: combines hook outputs into a single logical result

Hook events are defined in [`src/hooks/types.ts`](../src/hooks/types.ts):

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `SessionEnd`
- `PreCompact`

### Default hook registry

`createDefaultHookRegistry()` currently assembles the default stack in this order:

1. mode registry
2. project memory
3. learner
4. permission handler
5. recovery
6. subagent tracker
7. autopilot
8. ralph
9. ultrawork
10. pre-compact
11. session-end
12. keyword detector

Important behavior:

- Hooks are deterministic because they are event-filtered and priority-sorted.
- Hooks can attach warnings, system messages, activated modes, rerouted tasks, and arbitrary metadata.
- Mode hooks and keyword detection work together to reroute prompt-driven tasks into orchestrated execution.

### Notable hook modules

- [`src/hooks/keyword-hook.ts`](../src/hooks/keyword-hook.ts) routes prompt text to a mode via `routePromptToMode()`.
- [`src/hooks/autopilot/index.ts`](../src/hooks/autopilot/index.ts), [`src/hooks/ralph/index.ts`](../src/hooks/ralph/index.ts), and [`src/hooks/ultrawork/index.ts`](../src/hooks/ultrawork/index.ts) activate exclusive execution modes on `UserPromptSubmit`.
- [`src/hooks/mode-registry/index.ts`](../src/hooks/mode-registry/index.ts) prevents conflicting mode activation.
- [`src/hooks/permission-handler/index.ts`](../src/hooks/permission-handler/index.ts) auto-approves a narrow safe-command set and flags everything else for manual review.
- [`src/hooks/recovery/index.ts`](../src/hooks/recovery/index.ts) classifies failures into context-limit, permission, transient, tool-error, or fatal buckets and supports bounded retry.
- [`src/hooks/pre-compact/index.ts`](../src/hooks/pre-compact/index.ts) writes compaction checkpoints before context compaction.
- [`src/hooks/context-writer.ts`](../src/hooks/context-writer.ts) generates `.gemini/GEMINI.md` worker context with environment contracts, skill mappings, and learned/project-memory summaries.
- [`src/hooks/context-reader.ts`](../src/hooks/context-reader.ts) reads the worker context back into execution.

In practice, the hooks are the bridge between prompt-level behavior and orchestrated execution.

---

## 3) Execution modes: autopilot, ralph, ultrawork

Execution modes live under [`src/modes/`](../src/modes/).

All three modes share the same pattern:

1. create or update persisted mode state,
2. convert the prompt into a `TeamStartInput`,
3. delegate execution to `TeamOrchestrator`,
4. verify the result,
5. persist completion or failure,
6. optionally record a learned skill and project-memory task.

Shared helpers are in [`src/modes/common.ts`](../src/modes/common.ts).

### Autopilot

[`src/modes/autopilot.ts`](../src/modes/autopilot.ts)

- intended for one-shot autonomous end-to-end execution,
- writes `autopilot` mode state,
- runs a single team execution,
- verifies once and marks the run `completed` or `failed`.

### Ralph

[`src/modes/ralph.ts`](../src/modes/ralph.ts)

- is the iterative fix-loop mode,
- maintains `iteration` and `maxIterations`,
- reruns team execution until verification passes or the cap is reached,
- persists state for each iteration.

### Ultrawork

[`src/modes/ultrawork.ts`](../src/modes/ultrawork.ts)

- is the high-parallelism mode,
- defaults to more workers via `defaultWorkers()` in `src/modes/common.ts`,
- otherwise follows the same activate → run team → verify → persist lifecycle.

### Mode state

Mode names are centralized in [`src/lib/mode-names.ts`](../src/lib/mode-names.ts), and mode-state reads and writes are centralized in [`src/lib/mode-state-io.ts`](../src/lib/mode-state-io.ts).

That gives modes:

- session-scoped state isolation,
- atomic writes,
- shared naming conventions,
- consistent cleanup semantics.

---

## 4) Team orchestration

The team system is centered on [`src/team/team-orchestrator.ts`](../src/team/team-orchestrator.ts).

### Core orchestrator responsibilities

`TeamOrchestrator` is the coordination layer between CLI commands, the runtime backend, and durable state.

It is responsible for:

- selecting the runtime backend (`tmux` by default),
- initializing persisted phase and run metadata,
- pre-claiming tasks and wiring worker ownership,
- writing worker context,
- starting the runtime backend,
- monitoring run progress and health,
- evaluating success and verification contracts,
- persisting final snapshots and transitions.

### Runtime backend layer

The runtime contract is defined in [`src/team/runtime/runtime-backend.ts`](../src/team/runtime/runtime-backend.ts):

- `probePrerequisites(cwd)`
- `startTeam(input)`
- `monitorTeam(handle)`
- `shutdownTeam(handle, opts)`

The default registry is built by [`src/team/runtime/backend-registry.ts`](../src/team/runtime/backend-registry.ts), which registers:

- [`TmuxRuntimeBackend`](../src/team/runtime/tmux-backend.ts)
- [`SubagentsRuntimeBackend`](../src/team/runtime/subagents-backend.ts)

#### tmux backend

The tmux backend is the default production path.

Key behaviors:

- creates and controls tmux sessions and panes,
- launches canonical `worker-<n>` workers,
- injects `OMG_TEAM_*` and `OMX_TEAM_*` environment variables,
- monitors pane and session activity,
- interprets done, heartbeat, and status signals from persisted state.

#### subagents backend

The subagents backend is explicit and experimental.

It uses catalog-driven role selection and deterministic role outputs while preserving the same state and control-plane contracts as tmux.

### Control plane

The control plane lives under [`src/team/control-plane/`](../src/team/control-plane).

It provides deterministic primitives for multi-worker coordination:

- task claiming and leasing,
- transition validation,
- task release semantics,
- mailbox delivery state,
- filesystem-safe identifiers,
- structured failure taxonomy.

Important files:

- [`task-lifecycle.ts`](../src/team/control-plane/task-lifecycle.ts)
- [`mailbox-lifecycle.ts`](../src/team/control-plane/mailbox-lifecycle.ts)
- [`identifiers.ts`](../src/team/control-plane/identifiers.ts)
- [`failure-taxonomy.ts`](../src/team/control-plane/failure-taxonomy.ts)

This is what keeps state mutations deterministic across processes instead of relying on ad hoc JSON edits.

### Task lifecycle

The current task lifecycle is roughly:

1. the orchestrator creates and persists task records,
2. the control plane pre-claims tasks for workers,
3. each worker starts with `OMG_WORKER_TASK_ID` and `OMG_WORKER_CLAIM_TOKEN`,
4. the worker transitions task state through `in_progress` and a terminal status,
5. audit events are appended to `events/task-lifecycle.ndjson`,
6. the monitor and orchestrator compute team health and success from persisted state.

### Worker bootstrap

Worker bootstrap is implemented by [`src/cli/commands/worker-run.ts`](../src/cli/commands/worker-run.ts).

It:

- resolves `team` and `worker` identity,
- registers start and stop with the subagent tracker helpers,
- writes worker status and recurring heartbeat signals,
- loads `.gemini/GEMINI.md` team context,
- either runs OMG-internal worker logic or `gemini -p` prompt-mode execution,
- writes a final done signal and task transition outcome.

This worker command is the runtime handoff point between the orchestrator and actual worker execution.

### Role-aware coordination

Role-aware helpers augment basic worker orchestration:

- [`src/team/agent-coordination.ts`](../src/team/agent-coordination.ts) groups workers into plan, execute, and verify stages and creates handoff edges.
- [`src/team/role-management.ts`](../src/team/role-management.ts) resolves role profiles, model tiers, and role metadata.
- [`src/team/role-skill-mapping.ts`](../src/team/role-skill-mapping.ts) maps canonical skills (`plan`, `team`, `review`, `verify`, `handoff`) to primary and fallback roles.
- [`src/team/subagents-catalog.ts`](../src/team/subagents-catalog.ts) loads and validates subagent catalog entries.
- [`src/team/subagents-blueprint.ts`](../src/team/subagents-blueprint.ts) supplies the default catalog blueprint.

---

## 5) Skill system

The skill system lives under [`src/skills/`](../src/skills/).

### Resolution and listing

[`src/skills/resolver.ts`](../src/skills/resolver.ts):

- discovers `SKILL.md` files,
- parses simple frontmatter (`name`, `aliases`, `primaryRole`, etc.),
- resolves skills by name or alias,
- skips deprecated, alias-only, or non-installable entries when appropriate,
- supports both source and packaged extension lookup paths.

### Dispatch

[`src/skills/dispatcher.ts`](../src/skills/dispatcher.ts):

- lists available skills,
- resolves a selected skill,
- expands user arguments into prompt text when required.

### CLI surface

[`src/cli/commands/skill.ts`](../src/cli/commands/skill.ts) exposes the system as:

- `omg skill list`
- `omg skill <name> [args...]`

The CLI prints skill metadata plus the underlying `SKILL.md` content.

### Relationship to team orchestration

Skills are not isolated from orchestration:

- worker context includes canonical role and skill mappings,
- role selection can be inferred from skill tokens,
- learned skills can be recorded after successful mode execution,
- extension assets ship a public skill catalog under `extensions/oh-my-gemini/skills/`.

---

## 6) Notification system

Notifications live under [`src/notifications/`](../src/notifications/).

### Supported outputs

Current notification targets include:

- Slack webhooks,
- Discord webhooks,
- Telegram bot messages,
- generic HTTPS webhooks,
- stop-callback delivery.

### Main entry points

[`src/notifications/index.ts`](../src/notifications/index.ts) provides the orchestration layer to:

- read and write stop-callback config,
- save session summaries,
- dispatch per-platform notifications,
- build generic webhook payloads,
- merge and normalize notification tags.

Supporting files:

- [`summary.ts`](../src/notifications/summary.ts): session summary rendering
- [`tags.ts`](../src/notifications/tags.ts): tag normalization and formatting
- [`webhook.ts`](../src/notifications/webhook.ts): generic and Slack webhook transport
- [`discord.ts`](../src/notifications/discord.ts): Discord transport
- [`telegram.ts`](../src/notifications/telegram.ts): Telegram transport

Architecturally, notifications are downstream of state and orchestration. They report what happened; they are not the source of truth.

---

## 7) State management

Durable state is a first-class architectural boundary in OMG.

### State modules

Primary modules live under [`src/state/`](../src/state/):

- [`filesystem.ts`](../src/state/filesystem.ts): atomic JSON and NDJSON helpers plus directory creation
- [`team-state-store.ts`](../src/state/team-state-store.ts): canonical team, task, mailbox, and worker persistence
- [`shared-memory.ts`](../src/state/shared-memory.ts): shared memory and handoff durability helpers
- [`session-registry.ts`](../src/state/session-registry.ts): session logging and lookup
- [`token-tracking.ts`](../src/state/token-tracking.ts): token and cost usage logging and summaries

### On-disk layout

The canonical team state layout is documented in [`docs/architecture/state-schema.md`](./architecture/state-schema.md).

Key persisted artifacts include:

- `phase.json`
- `monitor-snapshot.json`
- `run-request.json`
- `events/phase-transitions.ndjson`
- `events/task-lifecycle.ndjson`
- `tasks/task-<id>.json`
- `mailbox/<worker>.ndjson`
- `workers/<worker>/{identity,status,heartbeat,done}.json`

### Design intent

The state layer exists so that team execution is:

- resumable,
- observable,
- auditable,
- safe across multiple processes,
- testable without depending only on live tmux state.

That is why state ownership is explicit: orchestrator, control plane, and worker signals each own specific files and mutation types.

---

## 8) Extension system

OMG is intentionally extension-first.

### Canonical public surface

The extension package lives in [`extensions/oh-my-gemini/`](../extensions/oh-my-gemini/).

Important assets:

- [`gemini-extension.json`](../extensions/oh-my-gemini/gemini-extension.json)
- [`GEMINI.md`](../extensions/oh-my-gemini/GEMINI.md)
- `commands/*.toml`
- `skills/*/SKILL.md`

### What the extension provides

The extension package defines:

- extension metadata and command and skill catalogs,
- the public Gemini-facing context file,
- packaged command prompts,
- packaged skills that mirror OMG workflows.

### Setup integration

[`src/installer/index.ts`](../src/installer/index.ts) wires the extension into project or user environments by managing `.gemini/` artifacts such as:

- `.gemini/settings.json`
- `.gemini/GEMINI.md`
- `.gemini/sandbox.Dockerfile`
- `.gemini/agents/catalog.json`

It also registers the built-in MCP tools server (`oh-my-gemini tools serve`) in Gemini settings when needed.

### Why it matters

Architecturally, the extension is the stable UX layer and the TypeScript CLI is the control-plane and runtime implementation. That separation lets OMG ship structured prompts and skills without coupling everything to a CLI-only surface.

---

## 9) Putting it together

A typical OMG path looks like this:

1. `omg` or `omg team run` enters through `src/cli/index.ts`.
2. CLI command handlers resolve extension assets, team input, or direct runtime actions.
3. Hooks classify the prompt, apply guardrails, and may activate a mode.
4. Modes delegate execution to `TeamOrchestrator`.
5. `TeamOrchestrator` writes canonical state, chooses the runtime backend, and starts workers.
6. Workers execute with `.gemini/GEMINI.md` context and report heartbeats, status, and done signals.
7. The control plane validates task and mailbox lifecycle transitions.
8. HUD rendering, resume flows, notifications, and summaries all read from the same persisted artifacts.

That makes OMG less like a thin wrapper around Gemini CLI and more like a compact orchestration platform with:

- a prompt and extension UX layer,
- a command and control layer,
- a deterministic state and control-plane core,
- pluggable runtime backends,
- reusable skills and notifications around the edges.
