# oh-my-product Core Context

Shared context layer loaded by all oh-my-product sessions. This provides stable runtime rules, role catalogs, and workflow definitions.

## Agent Catalog

### Build & Analysis
| Agent | Tier | Mission |
|-------|------|---------|
| explore | flash-lite | Map files, symbols, and relationships through fast read-only search |
| analyst | pro | Analyze requirement gaps and acceptance criteria |
| planner | pro | Create dependency-aware execution plans |
| architect | pro | Define boundaries, interfaces, and architecture trade-offs |
| debugger | flash | Isolate root causes and propose reproducible fixes |
| executor | flash | Implement scoped tasks with minimal, reviewable changes |
| deep-executor | pro | Execute complex multi-step tasks end-to-end |
| verifier | flash | Verify completion claims against evidence |

### Review
| Agent | Tier | Mission |
|-------|------|---------|
| code-reviewer | pro | Severity-rated review for correctness and maintainability |
| quality-reviewer | flash | Detect logic defects and anti-patterns |
| security-reviewer | flash | Audit vulnerabilities and trust boundaries |

### Domain
| Agent | Tier | Mission |
|-------|------|---------|
| test-engineer | flash | Design test strategy, strengthen coverage |
| build-fixer | flash | Resolve build/type/compile failures |
| designer | flash | UI/UX architecture and interaction design |
| writer | flash-lite | Technical docs, migration notes, handoff |
| qa-tester | flash | Interactive CLI/service runtime validation |
| scientist | flash | Data analysis and evidence-backed findings |
| document-specialist | flash | External documentation and reference lookup |
| git-master | flash | Git operations, commit history management |
| code-simplifier | pro | Code clarity and simplification |

### Orchestration
| Agent | Tier | Mission |
|-------|------|---------|
| critic | pro | Critique plans for completeness and implementability |

### Specialized Review
| Agent | Tier | Mission |
|-------|------|---------|
| api-reviewer | flash | API contracts, backward compatibility, error semantics |
| performance-reviewer | flash | Hotspots, algorithmic complexity, memory/latency |
| style-reviewer | flash | Formatting, naming conventions, language idioms |
| harsh-critic | pro | Final quality gate with structured gap analysis |

### Product & Strategy
| Agent | Tier | Mission |
|-------|------|---------|
| product-manager | pro | Problem framing, value hypotheses, PRDs |
| product-analyst | flash | Product metrics, event schemas, funnel analysis |
| quality-strategist | pro | Quality strategy, release readiness, risk models |
| information-architect | flash | Information hierarchy, taxonomy, navigation |
| ux-researcher | flash | Usability research, heuristic audits |

### Design & Implementation
| Agent | Tier | Mission |
|-------|------|---------|
| design-architect | pro | Design system architecture and component structure |
| design-validator | flash | Validate design implementations against specifications |
| implementation-planner | pro | Plan implementation steps from design specifications |

### Specialist
| Agent | Tier | Mission |
|-------|------|---------|
| tracer | flash | Evidence-driven causal tracing with hypotheses |
| dependency-expert | flash | External SDK/API/package evaluation |
| vision | flash | Image, PDF, diagram, visual media analysis |

## Workflow Stages

```
plan → exec → verify → fix (loop) → completed
```

Failure terminal: `failed` (from any phase that cannot recover).

### Stage Definitions

1. **Plan**: Decompose objective, identify dependencies, sequence tasks. PRD concerns (acceptance criteria, non-goals, constraints) are captured here conceptually; there is no separate `prd` lifecycle phase in the persisted state enum.
2. **Exec**: Dispatch tasks to agents, monitor progress
3. **Verify**: Check completion against acceptance criteria with evidence
4. **Fix**: Diagnose and resolve failures (max 3 iterations)
5. **Completed**: Terminal success phase (canonical value `completed`; legacy `complete` is read-normalized)

### Operating Profiles

The following profiles are implemented as execution modes (persisted in `MODE_NAMES`):

| Profile | Description | Gates | Parallelism |
|---------|-------------|-------|-------------|
| autopilot | Autonomous with periodic checkpoints | Auto | High |
| ralph | Strict quality-gated orchestration | Strict sequential | Medium |
| ultrawork | Maximum parallelism batch execution | Minimal | Maximum |

> **Note:** `balanced`, `speed`, and `deep` profiles are conceptual and not yet implemented as runtime modes.

### Approval Modes

> **Note:** The approval modes below are planned but not yet implemented in the codebase.

| Mode | Behavior |
|------|----------|
| suggest | Propose roster/plan, wait for user approval |
| auto | Auto-approve after safety checks; pause on risk |
| full-auto | Fully autonomous with periodic checkpoints |

## Quality Gates

### Gate Rules
- **Plan gate**: No execution without an approved plan
- **Review gate**: Code changes reviewed before merge
- **Test gate**: All tests must pass
- **Verify gate**: Verifier confirms with concrete evidence

### Reasoning Effort Levels
| Level | Model | Use Case |
|-------|-------|----------|
| low | gemini-3.1-flash-lite-preview | Fast lookups, simple tasks, standard implementation |
| pro | gemini-3.1-pro-preview | Complex architecture, deep analysis, security audits |

## State Management

All state persisted under `.omp/state/`. The canonical implemented layout is:

```
.omp/state/
  reasoning.json      — reasoning effort config (written by `omp reasoning`)
  team/<team>/        — canonical team runtime state (see docs/architecture/state-schema.md)
    phase.json
    monitor-snapshot.json
    run-request.json
    events/phase-transitions.ndjson
    events/task-lifecycle.ndjson
    tasks/task-<id>.json
    mailbox/<worker>.ndjson
    workers/worker-<n>/{identity,status,heartbeat,done}.json
  mode state          — written by `src/lib/mode-state-io.ts` (autopilot/ralph/ultrawork)
```

> **Note:** Earlier drafts documented additional files (`mode.json`, `approval.json`, `taskboard.md`, `loop.json`, `checkpoints/`, `decisions/`, `rules.json`, `memory/`, `prd.md`). Those are planned/conceptual and are not yet persisted by the current codebase.

## Conventions

- Task IDs are stable integers — never reuse, never renumber
- Status transitions: `pending → in_progress → completed | blocked | failed | cancelled | unknown`
- Workers complete atomic operations before halting on stop
- Failed gates trigger fix loops (max 3 attempts per gate)
- Checkpoints are lightweight — state references, not file copies
