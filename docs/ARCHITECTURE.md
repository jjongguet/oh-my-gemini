# OMG Architecture

This document describes the current `oh-my-gemini` architecture as implemented in the repository today. It focuses on the main execution path, extension-first integration model, team orchestration internals, and the persistence layers that make long-running Gemini workflows resumable.

## Overview

OMG is an extension-first orchestration layer for Gemini CLI workflows.

At a high level, OMG is composed of these layers:

- **CLI entry point** in `src/cli/index.ts`
- **Command handlers** in `src/cli/commands/`
- **Hook pipeline** in `src/hooks/`
- **Execution modes** in `src/modes/`
- **Team orchestration and runtime backends** in `src/team/`
- **State and persistence** in `src/state/` and `src/lib/`
- **Skill loading and dispatch** in `src/skills/`
- **Notifications** in `src/notifications/`
- **Gemini extension packaging** in `extensions/oh-my-gemini/`

The default runtime backend is **tmux**. Subagents remain opt-in and keyword-driven.

## High-level flow

```text
+-------------------+
| User / Operator   |
+---------+---------+
          |
          v
+-------------------+
| omg CLI           |  src/cli/index.ts
| command dispatch  |
+---------+---------+
          |
          +--------------------------+
          |                          |
          v                          v
+-------------------+      +-----------------------+
| Interactive launch|      | Team / verify / skill |
| Gemini CLI + ext  |      | command handlers      |
+---------+---------+      +-----------+-----------+
          |                            |
          v                            v
+-------------------+      +-----------------------+
| Gemini extension  |      | Hook pipeline         |
| GEMINI.md surface |      | src/hooks             |
+---------+---------+      +-----------+-----------+
          |                            |
          |                            v
          |                  +-----------------------+
          |                  | Execution mode /      |
          |                  | team orchestration    |
          |                  +-----------+-----------+
          |                              |
          |                              v
          |                  +-----------------------+
          |                  | Runtime backend       |
          |                  | tmux (default)        |
          |                  +-----------+-----------+
          |                              |
          +------------------------------+
                                         v
                              +-----------------------+
                              | Persisted state       |
                              | .omg/state, memory,  |
                              | audit, snapshots     |
                              +-----------+-----------+
                                          |
                                          v
                              +-----------------------+
                              | HUD / resume /        |
                              | notifications / verify|
                              +-----------------------+
```

## 1. CLI entry point and command dispatch

The primary executable is `src/cli/index.ts`.

### Responsibilities

- Resolve whether the invocation is a default interactive launch or an explicit subcommand.
- Load package metadata for `omg version`.
- Route commands to focused handlers in `src/cli/commands/`.
- Provide shared process dependencies such as cwd, env, and IO adapters.

### Important command groups

- **Launch**: `launch.ts`
- **Setup / update / uninstall**: `setup.ts`, `update.ts`, `uninstall.ts`
- **Doctor**: `doctor.ts`
- **Team lifecycle**: `team-run.ts`, `team-status.ts`, `team-resume.ts`, `team-shutdown.ts`, `team-cancel.ts`, `worker-run.ts`
- **Verify**: `verify.ts`
- **Skills**: `skill.ts`
- **Tools / MCP**: `tools.ts`, `mcp.ts`
- **Ask / cost / sessions / wait**: `ask.ts`, `cost.ts`, `sessions.ts`, `wait.ts`
- **HUD**: `hud.ts`
- **PRD**: `prd.ts`

### Default launch behavior

`omg` with no subcommand resolves to interactive launch behavior:

- If the process is already inside tmux, OMG launches Gemini directly there.
- Otherwise, OMG creates a new tmux session and launches Gemini CLI with the OMG extension loaded.

This behavior is implemented in `src/cli/commands/launch.ts`.

## 2. Hook system pipeline

The hook pipeline lives in `src/hooks/index.ts`.

### Core mechanics

- Hooks are registered as `RegisteredHook` entries.
- `runHookPipeline()` filters hooks by event, sorts them by priority, and runs them in deterministic order.
- `mergeHookResults()` combines results into a single effective outcome.

### Default hook registry

`createDefaultHookRegistry()` assembles the default hook chain:

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

### Supporting hooks and helpers

- `context-reader.ts` reads `.gemini/GEMINI.md`
- `context-writer.ts` writes worker context into `.gemini/GEMINI.md`
- `keyword-hook.ts` routes prompts to execution modes via keyword detection
- recovery, learner, project-memory, permission, and subagent-tracking hooks extend runtime behavior

### Why the pipeline exists

The pipeline lets OMG intercept prompt/task flows and add:

- execution mode routing
- memory capture
- resilience and recovery behavior
- permission handling
- subagent/task metadata tracking
- pre-compaction safety behavior

## 3. Execution modes

Execution modes live in `src/modes/` and are indexed through `src/modes/index.ts`.

The exported mode registry currently includes:

- `autopilot`
- `ralph`
- `ultrawork`

All modes share a common pattern:

- detect activation from prompt keywords
- persist mode-specific state under mode state files
- build a `TeamStartInput`
- run team execution
- verify the result
- record successful completions into learner/project memory flows

### Autopilot

Implemented in `src/modes/autopilot.ts`.

Behavior:

- optimized for end-to-end autonomous execution
- typically runs a single pass
- phases: `planning -> executing -> verifying -> completed|failed`
- writes persisted mode state with team name, prompt, workers, timestamps, and active state

### Ralph

Implemented in `src/modes/ralph.ts`.

Behavior:

- persistent verify/fix loop
- repeats until verification succeeds or max iterations are exhausted
- stores iteration count and max iteration limits in persisted mode state
- intended for stubborn tasks that require repeated execution/verification cycles

### Ultrawork

Implemented in `src/modes/ultrawork.ts`.

Behavior:

- parallelism-first mode
- chooses a higher worker count by default
- phases: `parallelizing -> running -> verifying -> completed|failed`
- suited for bursty or decomposable tasks where worker fan-out matters

## 4. Team orchestration

The team orchestration core lives in `src/team/team-orchestrator.ts`.

### Main responsibilities

The `TeamOrchestrator`:

- selects the runtime backend, defaulting to `tmux`
- validates backend prerequisites
- initializes persisted team scaffold and phase state
- writes worker context before runtime start
- pre-claims tasks for workers
- starts the runtime backend
- monitors verification/fix-loop progress
- persists snapshots, phase transitions, heartbeats, done signals, and audit trails

### Control plane

The control-plane modules live in `src/team/control-plane/`.

Important pieces:

- `task-lifecycle.ts` - task state machine and legal transitions
- `mailbox-lifecycle.ts` - worker mailbox lifecycle
- `failure-taxonomy.ts` - structured control-plane failures
- `identifiers.ts` - deterministic safe identifiers for teams, workers, and tasks

The control plane exists so orchestration logic and runtime workers share a deterministic task model.

### Task lifecycle

The persisted task model supports transitions such as:

- `pending`
- `in_progress`
- `completed`
- `failed`
- `blocked`
- `cancelled`

The orchestrator pre-claims tasks and passes claim tokens into workers. For tmux workers, those claims are injected through environment variables such as:

- `OMG_WORKER_TASK_ID`
- `OMG_WORKER_CLAIM_TOKEN`
- `OMG_TEAM_WORKER`
- `OMG_WORKER_NAME`
- `OMG_TEAM_STATE_ROOT`

This keeps task ownership deterministic across processes.

### Health and lifecycle monitoring

Supporting modules include:

- `monitor.ts` for health evaluation
- `agent-lifecycle.ts` for worker lifecycle tracking
- `agent-coordination.ts` and `role-management.ts` for role-aware coordination
- `worker-signals.ts` for heartbeats and completion signals

### Runtime backends

Backends live under `src/team/runtime/`.

The system is backend-driven through a runtime backend contract, but the default and intended production path is tmux.

#### tmux backend

The tmux runtime:

- creates or attaches tmux sessions/windows
- launches worker commands per pane
- injects runtime env and task-claim metadata
- polls heartbeats and done signals
- interprets pane activity and worker liveness
- supports lifecycle commands like status, resume, shutdown, and cancel through persisted state plus runtime handles

Subagents exist as an opt-in orchestration path rather than the default runtime.

## 5. Skill system

The skill system lives in `src/skills/`.

### Core files

- `resolver.ts`
- `dispatcher.ts`
- `index.ts`

### How it works

- Skills are loaded from `SKILL.md` files.
- OMG can resolve a skill by name or alias.
- Frontmatter is parsed for metadata such as `name`, `aliases`, `primaryRole`, `description`, deprecation, aliasing, and installability flags.
- Resolution prefers source/runtime skill directories, then falls back to extension-packaged skills.
- Deprecated, merged, and non-installable entries are skipped from the normal catalog.

### CLI exposure

`src/cli/commands/skill.ts` provides:

- `omg skill list`
- `omg skill <name> [args...]`

The command prints the resolved prompt content along with role and description metadata.

## 6. Notification system

Notifications live in `src/notifications/`.

### Supported delivery targets

- Slack
- Discord
- Telegram
- generic webhook
- stop-callback endpoint

### Main functions

`src/notifications/index.ts` handles:

- reading and writing stop-callback configuration
- saving structured session summaries
- dispatching notifications in parallel to enabled platforms
- composing stop-callback payloads with tags and summary metadata

Notification summaries are built from session/task context and can be emitted when long-running sessions stop or complete.

## 7. State management

State is split between `src/state/` and lower-level helpers in `src/lib/`.

### Team state

`TeamStateStore` in `src/state/team-state-store.ts` manages persisted team data such as:

- phase state
- worker status
- heartbeats
- done signals
- snapshots
- audit/event streams

This state is written under `.omg/state` and is what powers:

- `team status`
- `team resume`
- `team shutdown`
- `team cancel`
- HUD rendering
- reliability-oriented recovery behavior

### Shared memory

`src/state/shared-memory.ts` provides a shared memory manager with:

- namespaced entries
- optimistic versioning
- session tracking
- sync events
- TTL handling
- handoff support
- file locking and durable write behavior

This is used for cross-session coordination and durable handoff behavior.

### Supporting lib primitives

`src/lib/` contains common persistence and safety helpers such as:

- atomic writes
- file locks
- mode-state IO
- session isolation
- payload limits
- worktree paths
- version helpers

## 8. Extension system

OMG is explicitly extension-first.

### Extension package

The extension package lives in `extensions/oh-my-gemini/`.

Important files:

- `gemini-extension.json`
- `GEMINI.md`

### What the extension declares

The extension manifest declares:

- extension metadata and version
- the context file name (`GEMINI.md`)
- bundled skills exposed to Gemini
- MCP server registration for `oh-my-gemini tools serve`

This makes OMG usable as both:

- a CLI launcher around Gemini CLI
- an extension/context package that Gemini sessions can load directly

### Worker context injection

Before team execution starts, OMG writes `.gemini/GEMINI.md` with:

- team name
- task preview
- worker count
- state root
- worker environment variables
- done-signal protocol
- available role/skill mappings
- learned skills and project memory summary when available

That context file is the main handoff surface from orchestration logic into Gemini worker sessions.

## 9. HUD and verification as read-only consumers

Although not orchestration cores themselves, HUD and verification are important architectural consumers.

### HUD

The HUD modules in `src/hud/` read persisted team state and render a live operational view.

### Verification

The verification modules in `src/verification/` define suite tiers and test runners used by `omg verify`, packaging validation into predictable tiers such as:

- typecheck
- smoke
- integration
- reliability

These layers do not drive the runtime directly; they consume persisted state and command surfaces to assess correctness.

## 10. Architectural design principles

The current codebase consistently reflects these principles:

- **tmux first**: tmux is the default runtime backend and the baseline operational path.
- **extension first**: the Gemini extension and `GEMINI.md` context are core UX surfaces, not afterthoughts.
- **persist everything important**: team runs, worker signals, mode state, shared memory, and summaries are written to disk.
- **deterministic recovery**: state schemas, task claims, atomic writes, and health checks are designed to make resume/recovery predictable.
- **role and skill awareness**: routing and worker context both preserve skill/role intent.
- **verification-oriented delivery**: validation tiers are treated as a first-class part of the product surface.

## Source map

| Concern | Primary paths |
| ------- | ------------- |
| CLI entry point | `src/cli/index.ts` |
| Command handlers | `src/cli/commands/` |
| Hooks | `src/hooks/` |
| Modes | `src/modes/` |
| Team orchestration | `src/team/` |
| Runtime backends | `src/team/runtime/` |
| Control plane | `src/team/control-plane/` |
| State | `src/state/`, `src/lib/` |
| Skills | `src/skills/` |
| Notifications | `src/notifications/` |
| Extension | `extensions/oh-my-gemini/` |
| HUD | `src/hud/` |
| Verification | `src/verification/` |
