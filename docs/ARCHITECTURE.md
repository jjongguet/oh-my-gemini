# OMG Architecture

This document describes the current high-level architecture of `oh-my-gemini` (OMG) as implemented in the repository on version `0.4.0`.

OMG is intentionally split into a small public UX surface and a larger internal control plane:

- **Public UX:** the `omg` CLI and the Gemini extension package in `extensions/oh-my-gemini/`
- **Core control plane:** command handlers, orchestrators, hooks, runtime backends, state, skills, and notifications under `src/`
- **Persistence and observability:** deterministic JSON/NDJSON state under `.omg/state/`

---

## 1. High-level structure

| Area | Main paths | Responsibility |
| --- | --- | --- |
| CLI entry points | `src/cli/**` | Parse commands, print help, and dispatch into runtime/application services |
| Extension package | `extensions/oh-my-gemini/**` | Gemini-facing context, command templates, packaged skills, and extension manifest |
| Installer/setup | `src/installer/**` | Write managed `.gemini` files, setup scope metadata, and MCP/server config |
| Team orchestration | `src/team/**` | Coordinate worker execution, lifecycle phases, control-plane state, and runtime backends |
| Hooks + modes | `src/hooks/**`, `src/modes/**` | Event pipeline, keyword routing, autonomous modes, recovery, and learned behavior |
| Skills | `src/skills/**`, `extensions/oh-my-gemini/skills/**` | Resolve reusable workflow prompts from the runtime and extension package |
| Notifications | `src/notifications/**` | Session summaries and outbound delivery to Slack/Discord/Telegram/webhooks |
| State | `src/state/**`, `src/lib/**` | Persist team snapshots, task/mailbox events, shared memory, session data, and mode state |
| Verification/tooling | `src/verification/**`, `src/tools/**`, `src/mcp/**` | Verify tiers, MCP tool surfaces, file/exec adapters, and validation harnesses |

---

## 2. High-level execution flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│ User / operator                                                    │
│  - runs `omg`, `omg launch`, `omg team run`, `omg verify`, etc.    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CLI entrypoint: src/cli/index.ts                                   │
│  - resolves subcommand or default launch                           │
│  - builds command context (cwd/env/io/dependencies)                │
│  - dispatches to command modules                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌────────────────┐   ┌────────────────────┐  ┌───────────────────────┐
│ launch/setup   │   │ team orchestration │  │ verify / tools / hud │
│ installer/ext  │   │ TeamOrchestrator   │  │ skills / ask / cost  │
└───────┬────────┘   └──────────┬─────────┘  └──────────┬────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌────────────────┐   ┌────────────────────┐  ┌───────────────────────┐
│ .gemini files  │   │ Runtime backend    │  │ Shared services       │
│ extension path │   │ tmux / subagents   │  │ hooks, notifications, │
│ MCP settings   │   │ control plane      │  │ state, verification   │
└───────┬────────┘   └──────────┬─────────┘  └──────────┬────────────┘
        │                       │                        │
        └──────────────┬────────┴──────────────┬─────────┘
                       ▼                       ▼
             ┌──────────────────┐   ┌────────────────────┐
             │ `.gemini/GEMINI` │   │ `.omg/state/**`    │
             │ worker context   │   │ JSON/NDJSON state  │
             └──────────────────┘   └────────────────────┘
```

---

## 3. CLI entry point and command dispatch

The CLI entry point lives at `src/cli/index.ts`.

### Responsibilities

- Loads package version metadata
- Resolves the invoked command via `resolveCliInvocation(...)`
- Treats bare `omg` as **interactive launch** by default
- Creates a normalized command context (`cwd`, `env`, `io`, injectable dependencies)
- Dispatches to command modules such as:
  - `launch`
  - `setup`, `update`, `uninstall`, `doctor`
  - `team run`, `team status`, `team resume`, `team shutdown`, `team cancel`
  - `worker run`
  - `skill`, `prd`, `tools`, `mcp`, `hud`, `verify`
  - `ask`, `cost`, `sessions`, `wait`

### Default launch path

`src/cli/commands/launch.ts` is the interactive front door:

- resolves the extension root through `resolveExtensionPath(...)`
- decides whether to run:
  - **inside the current tmux pane**, or
  - in a **new tmux session**
- launches Gemini CLI with:
  - `gemini --extensions <extension-path> ...`
- supports `--madmax`, which expands to `--yolo --sandbox=none`

This is why OMG feels lightweight to use: the CLI is a thin shell over a persisted orchestration/control plane rather than a monolithic runtime.

---

## 4. Extension system

The extension package in `extensions/oh-my-gemini/` is the canonical public Gemini-facing UX surface.

### Main files

- `extensions/oh-my-gemini/gemini-extension.json`
  - extension manifest
  - declares context file, skills, and MCP servers
- `extensions/oh-my-gemini/GEMINI.md`
  - operator guidance and extension context
- `extensions/oh-my-gemini/commands/**/*.toml`
  - packaged command templates
- `extensions/oh-my-gemini/skills/**/SKILL.md`
  - packaged skill prompts

### How it is wired

- `src/cli/commands/extension-path.ts` resolves the extension root from:
  - explicit override
  - current workspace
  - installed package layout
- `src/installer/index.ts` writes managed `.gemini/settings.json` and `.gemini/GEMINI.md`
- setup also configures the built-in MCP server (`oh-my-gemini tools serve`) into Gemini settings

### Design intent

The extension surface is public and stable; orchestration internals stay in `src/`.
That keeps the user-facing package simple while allowing runtime internals to evolve.

---

## 5. Hook system pipeline

OMG now has a hook pipeline in `src/hooks/index.ts`.

### Core model

Hooks are registered as `RegisteredHook` objects with:

- `name`
- `events`
- optional `priority`
- async `handler(context)`

Hook contexts are described in `src/hooks/types.ts` and can carry:

- session and cwd information
- prompt/task text
- team metadata
- tool input/output
- permission requests
- arbitrary metadata

### Events

Supported hook events are:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `SessionEnd`
- `PreCompact`

### Pipeline behavior

`runHookPipeline(...)`:

1. filters hooks by event
2. sorts them by ascending priority
3. executes them in order
4. merges results via `mergeHookResults(...)`

### Default registry

`createDefaultHookRegistry()` wires together the built-in hooks:

- mode registry
- project memory
- learner
- permission handler
- recovery
- subagent tracker
- autopilot activation
- ralph activation
- ultrawork activation
- pre-compact preservation
- session-end export/cleanup
- keyword detection

### Why hooks matter

Hooks are the glue between interactive Gemini usage and OMG's persistence model:

- they decide when a prompt should activate a mode
- they preserve context before compaction
- they record successful patterns for later reuse
- they export summaries at session end
- they keep recovery, memory, and orchestration behavior coordinated without putting that logic into the CLI layer

---

## 6. Execution modes

Execution modes live in `src/modes/` and are registered in `src/modes/index.ts`.

They are not separate runtimes; instead, they are higher-level orchestration strategies built on top of the team runtime.

### Shared behavior

All modes use helpers from `src/modes/common.ts` to:

- derive a normalized mode-specific team name
- choose default worker counts
- build a `TeamStartInput`
- execute the underlying team run through `TeamOrchestrator`
- verify completion using a default success rule or injected verifier

### Autopilot

File: `src/modes/autopilot.ts`

- goal: end-to-end autonomous execution
- default worker count: typically `1` unless the prompt implies more
- phases: `planning -> executing -> verifying -> completed/failed`
- on success, records learned patterns and project memory entries

### Ralph

File: `src/modes/ralph.ts`

- goal: persistent verify/fix looping
- runs multiple iterations until verification passes or max iterations are exhausted
- designed for "do not stop until verified" behavior
- persists iteration count and final status

### Ultrawork

File: `src/modes/ultrawork.ts`

- goal: high-throughput parallel execution
- default worker count: `6`
- phases: `parallelizing -> running -> verifying -> completed/failed`
- optimized for bursty parallel work instead of single-agent execution

### Keyword routing

`src/hooks/keyword-detector/index.ts` maps user phrasing into modes and worker hints.
Examples include tokens like:

- `autopilot`
- `ralph`
- `ultrawork`
- `team`
- `cancel`

This means modes can be activated from natural prompt language rather than only explicit flags.

---

## 7. Team orchestration

Team orchestration is the core OMG runtime, implemented primarily in `src/team/`.

### 7.1 Main orchestrator

`src/team/team-orchestrator.ts` is the control-plane leader.

Its `run(...)` flow is roughly:

1. choose backend (`tmux` by default)
2. create or normalize run metadata
3. scaffold `.omg/state/team/<team>/`
4. write phase state (`plan` first)
5. probe backend prerequisites
6. transition to `exec`
7. write worker context into `.gemini/GEMINI.md`
8. pre-claim tasks for workers when needed
9. start the backend runtime
10. monitor until workers finish or timeout
11. enrich snapshots from persisted worker heartbeats/status/done signals
12. evaluate health and success checklist
13. persist monitor snapshots and phase transitions
14. either:
    - complete successfully, or
    - enter `fix` / retry loops, or
    - fail with persisted diagnostics

### 7.2 Lifecycle phases

Canonical team phases are:

- `plan`
- `exec`
- `verify`
- `fix`
- `completed`
- `failed`

These are persisted to `phase.json` and mirrored in append-only event logs.

### 7.3 Runtime backends

The backend contract lives in `src/team/runtime/runtime-backend.ts`.
A backend must implement:

- `probePrerequisites(cwd)`
- `startTeam(input)`
- `monitorTeam(handle)`
- `shutdownTeam(handle, opts)`

Default registry: `src/team/runtime/backend-registry.ts`

Available backends:

- `TmuxRuntimeBackend` (`src/team/runtime/tmux-backend.ts`)
- `SubagentsRuntimeBackend` (`src/team/runtime/subagents-backend.ts`)

#### tmux backend

The tmux backend is the production default.
It is responsible for:

- session/window sizing
- worker pane startup
- worker command construction
- environment injection (`OMG_TEAM_*`, worker IDs, claim tokens, state root)
- delivery acknowledgement via heartbeat/status/done signals
- runtime snapshot monitoring

tmux workers ultimately run `omg worker run` (or optionally Gemini CLI prompt mode) so that runtime semantics still flow through OMG state contracts.

### 7.4 Control plane

The task/mailbox control plane lives in `src/team/control-plane/`.

#### Task control plane

`TaskControlPlane` provides guarded lifecycle mutations:

- claim a task
- transition task status
- release a claim
- cancel tasks
- reap expired claims

It enforces:

- dependency checks
- lease ownership
- claim-token matching
- current-status validation
- append-only lifecycle audit events with reason codes

#### Mailbox control plane

`MailboxControlPlane` provides deterministic worker messaging:

- send mailbox messages
- list mailbox messages
- mark delivered/notified
- collapse lifecycle history idempotently

This makes the runtime backend replaceable while keeping persisted semantics stable.

### 7.5 Task lifecycle model

At a high level, the task lifecycle looks like this:

```text
pending
  │
  ├─ claimTask() ──> in_progress
  │                    │
  │                    ├─ transition -> completed
  │                    ├─ transition -> failed
  │                    ├─ transition -> blocked
  │                    └─ releaseClaim -> pending
  │
  └─ cancelTask() ──> cancelled
```

### 7.6 Worker context injection

Before workers start, `src/hooks/context-writer.ts` writes `.gemini/GEMINI.md` with:

- team/task metadata
- environment-variable guidance
- done-signal protocol
- canonical role/skill mappings
- learned skills
- project-memory summary

That file is how worker sessions inherit OMG-specific operational context.

---

## 8. Skill system

OMG has two complementary skill surfaces.

### Runtime skill resolution

Files:

- `src/skills/resolver.ts`
- `src/skills/dispatcher.ts`

The runtime skill system:

- discovers `SKILL.md` files
- parses frontmatter (`name`, aliases, roles, installability flags)
- resolves direct names and aliases
- skips deprecated/non-installable/merged skills
- dispatches a selected skill with optional arguments

By default it searches:

1. the source/runtime skill directory
2. the built package fallback
3. the extension-packaged skill directory

### Team skill routing

`src/team/role-skill-mapping.ts` defines canonical team skills:

- `plan`
- `team`
- `review`
- `verify`
- `handoff`

Each skill maps to:

- a primary role
- fallback roles
- normalized aliases

That gives OMG deterministic routing for commands such as:

- `/review`
- `/verify`
- `/handoff`
- `$planner`

### Learned skills

The learner hook records successful completion patterns and makes them available to future workers through injected context and persisted memory.

---

## 9. Notification system

Notifications live in `src/notifications/`.

### Supported targets

- Slack webhook
- Discord webhook
- Telegram bot
- generic webhook
- stop-callback endpoint

### Core responsibilities

- persist stop-callback configuration under `.omg/notifications/`
- generate session summaries via `buildSessionSummary(...)`
- save summary artifacts to `.omg/state/sessions/*.summary.json`
- fan out outbound deliveries through provider-specific adapters
- merge/prepend notification tags consistently across targets

### Why it exists

Notifications decouple execution from operator awareness:

- team runs and sessions can finish asynchronously
- summaries remain available on disk even if webhook delivery fails
- the same summary payload can feed chat tools, automation, or post-run callbacks

---

## 10. State management

State management is one of the most important architectural pillars in OMG.

### 10.1 Team state store

Primary implementation: `src/state/team-state-store.ts`

The `TeamStateStore` owns deterministic persistence under `.omg/state/team/<team>/`.
It normalizes identifiers, writes JSON atomically, and keeps append-only NDJSON logs for audit-style data.

### Canonical artifacts

Key persisted files include:

- `phase.json`
- `events/phase-transitions.ndjson`
- `events/task-lifecycle.ndjson`
- `monitor-snapshot.json`
- `run-request.json`
- `resume-input.json` (compatibility bridge)
- `tasks/task-<id>.json`
- `mailbox/<worker>.ndjson`
- `workers/<worker>/{identity,status,heartbeat,done}.json`
- `workers/<worker>/inbox.md`

### 10.2 Additional state subsystems

Other state modules add persistence outside team runs:

- `src/state/session-registry.ts` for session tracking
- `src/state/token-tracking.ts` for usage/cost records
- `src/state/shared-memory.ts` and `src/lib/shared-memory.ts` for shared memory and handoff durability
- `src/lib/mode-state-io.ts` for per-mode state files such as `autopilot-state.json` and `ralph-state.json`

### Design principles

OMG state is designed to be:

- **deterministic** - avoid implicit mutation paths
- **auditable** - append logs for lifecycle-critical events
- **recoverable** - resume from persisted input and snapshots
- **backend-agnostic** - keep tmux/subagents replaceable
- **safe by default** - normalize identifiers, reject invalid transitions, fail closed on bad config

---

## 11. Verification and observability

Although not a single subsystem, several modules reinforce runtime confidence:

- `src/verification/**` provides tier selectors, runners, and assertion helpers
- `src/hud/**` renders live team status from persisted state
- `src/cli/commands/doctor.ts` checks local prerequisites and writable state roots
- `src/team/monitor.ts` converts runtime snapshots into health assessments

This is why OMG can support long-running orchestration without relying only on terminal output.

---

## 12. Design summary

OMG is best understood as a layered system:

1. **CLI + extension** provide the user-facing entry points.
2. **Commands** translate user intent into structured operations.
3. **Hooks and modes** add automation, routing, memory, and recovery.
4. **Team orchestration** executes work through tmux/subagent backends.
5. **State + notifications + HUD** make the system observable and resumable.

That separation is what lets OMG stay extension-first and UX-light while still supporting durable multi-agent workflows.
