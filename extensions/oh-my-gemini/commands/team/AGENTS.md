<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# team

## Purpose
Contains extension prompt templates for team-oriented execution flows: standard run, subagents run, live OMX team bridge, and verification.

## Key Files

| File | Description |
|------|-------------|
| `run.toml` | Default team orchestration (`omg team run`) flow with reporting expectations. |
| `subagents.toml` | Subagents backend flow with setup preflight and role assignment focus. |
| `live.toml` | Live operator path using `omx team` start/status/shutdown cycle. |
| `verify.toml` | Verification workflow prompt (`npm run verify`). |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Keep lifecycle reporting explicit: commands, exit codes, state/log paths.
- Ensure subagents guidance includes opt-in and catalog prerequisites.

### Testing Requirements
- Run at least dry-run/local-safe command variants when modifying prompts.

### Common Patterns
- Prompts include preconditions, execution steps, and structured report sections.

## Dependencies

### Internal
- Depends on `scripts/e2e-omx-team.sh`, `npm run omg -- team run`, and `.omg/.omx` state paths.

### External
- `omx`, `tmux`, and Gemini runtime environment for live flows.

<!-- MANUAL: -->
