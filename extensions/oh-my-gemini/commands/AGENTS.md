<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# commands

## Purpose
Defines extension command prompts that map user intent to concrete `oh-my-gemini` CLI/script actions.

## Key Files

| File | Description |
|------|-------------|
| `setup.toml` | Runs setup + subagent catalog provisioning and summarizes outcomes. |
| `doctor.toml` | Runs prerequisite diagnostics and reports actionable remediation. |
| `tools.toml` | Lists/registers built-in CLI MCP tools (file/git/http/process) for Gemini extension usage. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `team/` | Team orchestration command prompts (run/live/subagents/verify). See `team/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Ensure prompts include exact commands and expected reporting outputs.
- Keep failure-handling instructions concise and operational.

### Testing Requirements
- Execute referenced commands locally to confirm they still exist and return expected artifacts.

### Common Patterns
- TOML prompt bodies are imperative checklists with output summary requirements.

## Dependencies

### Internal
- Uses npm script surface and `omg` CLI options.

### External
- Gemini extension prompt execution.

<!-- MANUAL: -->
