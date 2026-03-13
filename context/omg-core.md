# oh-my-gemini Core Context

Shared context layer loaded by all oh-my-gemini sessions. This provides stable runtime rules, role catalogs, and workflow definitions.

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

### Specialist
| Agent | Tier | Mission |
|-------|------|---------|
| tracer | flash | Evidence-driven causal tracing with hypotheses |
| dependency-expert | flash | External SDK/API/package evaluation |
| vision | flash | Image, PDF, diagram, visual media analysis |

## Workflow Stages

```
plan → prd → exec → verify → fix (loop) → done
```

### Stage Definitions

1. **Plan**: Decompose objective, identify dependencies, sequence tasks
2. **PRD**: Lock acceptance criteria, non-goals, constraints
3. **Exec**: Dispatch tasks to agents, monitor progress
4. **Verify**: Check completion against acceptance criteria with evidence
5. **Fix**: Diagnose and resolve failures (max 3 iterations)

### Operating Profiles

| Profile | Description | Gates | Parallelism |
|---------|-------------|-------|-------------|
| balanced | Standard workflow with review gates | All | Medium |
| speed | Throughput-optimized, fewer gates | Minimal | High |
| deep | High-reasoning, thorough review | All + extra | Low |
| autopilot | Autonomous with periodic checkpoints | Auto | High |
| ralph | Strict quality-gated orchestration | Strict sequential | Medium |
| ultrawork | Maximum parallelism batch execution | Minimal | Maximum |

### Approval Modes

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
| low | gemini-3-flash-lite | Fast lookups, simple tasks |
| medium | gemini-3-flash | Standard implementation |
| high | gemini-3-pro | Complex architecture, deep analysis |
| xhigh | gemini-3-pro + thinking | Security audits, critical decisions |

## State Management

All state persisted under `.omg/state/`:
```
.omg/state/
  mode.json           — active operating profile
  approval.json       — approval posture
  reasoning.json      — reasoning effort config
  taskboard.md        — task ledger with stable IDs
  ralph.json          — ralph mode state
  ultrawork.json      — ultrawork mode state
  loop.json           — loop iteration state
  checkpoints/        — saved checkpoints
  decisions/          — consensus decision records
  rules.json          — active guardrail pack
  memory/             — session knowledge entries
  prd.md              — locked product requirements
```

## Conventions

- Task IDs are stable integers — never reuse, never renumber
- Status transitions: `pending → active → done → verified | blocked | failed`
- Workers complete atomic operations before halting on stop
- Failed gates trigger fix loops (max 3 attempts per gate)
- Checkpoints are lightweight — state references, not file copies
