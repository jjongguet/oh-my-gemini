---
name: context-optimize
aliases: ["/context-optimize", "optimize context", "compress context"]
primaryRole: optimizer
description: Analyze and optimize context for signal-to-noise ratio — deduplicate, compress, prioritize, and prune.
---

# Context Optimize Skill (oh-my-product)

Optimize prompt and context files for maximum signal density.

## Use when
- GEMINI.md or context files have grown large and unfocused
- Session context feels bloated with stale information
- Token budget is tight and every token must count
- After a major feature addition that expanded context

## Workflow
1. **Audit**: Measure current context size and composition
2. **Score**: Rate each section for signal density (useful / total tokens)
3. **Identify issues**: Flag duplicates, stale entries, verbose sections
4. **Propose changes**: Show diff of recommended optimizations
5. **Apply**: With user approval, apply the optimizations

## Optimization Strategies

| Strategy | Description | Risk |
|----------|-------------|------|
| Deduplicate | Remove repeated instructions across layers | Low |
| Compress | Shorten verbose sections preserving meaning | Low |
| Prioritize | Move high-signal content earlier in context | Low |
| Prune | Remove stale or irrelevant entries | Medium |
| Restructure | Improve formatting for model parsing | Low |

## Metrics

```
Before: 4,200 tokens | Signal: 62% | Redundancy: 18% | Stale: 12%
After:  2,800 tokens | Signal: 89% | Redundancy: 3%  | Stale: 0%
Savings: 33% token reduction
```

## 5-Layer Context Model

oh-my-product contexts follow this priority hierarchy:

1. **System/Runtime**: Gemini CLI constraints (immutable)
2. **Project Standards**: GEMINI.md + context/omp-core.md
3. **Session Memory**: .omp/state/, memory entries
4. **Active Task**: Current plan, taskboard, PRD
5. **Execution Traces**: Recent iteration results

Optimization targets layers 2-5 (layer 1 is immutable).

## Safety Rules
- Never remove user-authored content without confirmation
- Always show diff before applying changes
- Preserve semantic meaning — compress, don't delete meaning
- Back up original before modifying

## Related commands
- `/omp:optimize` — quick context optimization command
- `/omp:memory compact` — compact memory entries specifically
