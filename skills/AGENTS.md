<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# skills

## Purpose
Package-facing extension skill prompts that provide reusable workflows for setup, planning, execution, review, status, waiting, and related OMG tasks.

## Key Files

No direct files at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `ask/` | Focused advisor-style Gemini prompt skill (see `ask/AGENTS.md`). |
| `autopilot/` | End-to-end autonomous execution skill (see `autopilot/AGENTS.md`). |
| `cancel/` | Safe cancellation and resumable shutdown skill (see `cancel/AGENTS.md`). |
| `configure-notifications/` | Notification setup and validation skill (see `configure-notifications/AGENTS.md`). |
| `cost/` | Usage and token-cost summarization skill (see `cost/AGENTS.md`). |
| `debug/` | Failure investigation and fix-loop skill (see `debug/AGENTS.md`). |
| `deep-interview/` | Requirements-clarification interview skill (see `deep-interview/AGENTS.md`). |
| `doctor/` | Environment and installation diagnostics skill (see `doctor/AGENTS.md`). |
| `execute/` | Concrete implementation/execution skill (see `execute/AGENTS.md`). |
| `handoff/` | Context handoff skill for next sessions or operators (see `handoff/AGENTS.md`). |
| `help/` | Usage-guidance skill for OMG commands and workflows (see `help/AGENTS.md`). |
| `hud-setup/` | HUD/statusline setup skill (see `hud-setup/AGENTS.md`). |
| `learn/` | Lesson-extraction and future-skill idea capture skill (see `learn/AGENTS.md`). |
| `plan/` | Phased planning skill aligned with canonical docs and gates (see `plan/AGENTS.md`). |
| `review/` | Structured code review skill (see `review/AGENTS.md`). |
| `sessions/` | Session history and resumable-run inspection skill (see `sessions/AGENTS.md`). |
| `status/` | Progress/status checkpoint skill (see `status/AGENTS.md`). |
| `team/` | Multi-worker team orchestration skill (see `team/AGENTS.md`). |
| `verify/` | Acceptance-verification skill (see `verify/AGENTS.md`). |
| `wait/` | Rate-limit waiting and auto-resume skill (see `wait/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep skill frontmatter (`name`, aliases, description, role hints) and examples aligned with the current OMG command surface.
- Treat root-level `skills/` as packaged/public skill assets; runtime loading and dispatch logic belongs under `src/skills/`.
- Avoid documenting commands that are aspirational or removed without clearly flagging them.

### Testing Requirements
- Validate SKILL.md examples against the current CLI/docs when editing a skill.
- If a skill references a specific command or artifact path, verify it still exists.

### Common Patterns
- One directory per skill containing a `SKILL.md` file.
- Skills are workflow prompts, not implementation modules.

## Dependencies

### Internal
- Packaged alongside `commands/` and consumed by extension-facing workflows.
- Related runtime resolver and dispatcher logic lives under `src/skills/`.
- Canonical planning and verification references should come from `docs/planning/` and `docs/testing/` rather than generated state folders.

### External
- Gemini extension skill invocation model.

<!-- MANUAL: -->
