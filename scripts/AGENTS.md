<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# scripts

## Purpose
Contains automation scripts for bootstrap, smoke/integration checks, subagent setup, and live OMX team e2e validation.

## Key Files

| File | Description |
|------|-------------|
| `bootstrap-dev.sh` | Local bootstrap helper (deps install + baseline `.gemini/settings.json`). |
| `smoke-install.sh` | Idempotency smoke for repeated setup runs. |
| `setup-subagents.sh` | Ensures subagent catalog exists (delegates to setup when missing). |
| `sandbox-smoke.sh` | Dry-run/live sandbox validation wrapper around `gemini -s -p`. |
| `integration-team-run.sh` | Runs `omg team run` and checks `.omg/state` lifecycle markers. |
| `e2e-omx-team.sh` | Live `omx team` operator lifecycle (start/status/shutdown/cleanup). |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Preserve `set -euo pipefail` and explicit prerequisite checks.
- Keep scripts POSIX/Bash-friendly and deterministic in CI.

### Testing Requirements
- Execute modified scripts directly (`bash scripts/<name>.sh ...`) and capture exit status.
- For safety, prefer dry-run modes where available before live calls.

### Common Patterns
- Root-directory normalization (`ROOT_DIR=...; cd "$ROOT_DIR"`).
- Fast-fail command availability guards (`command -v`).

## Dependencies

### Internal
- Calls npm scripts and CLI commands defined in `package.json` / `src/cli`.

### External
- bash, npm, tmux, gemini CLI, Docker/Podman, and (for e2e) `omx` + `rg`.

<!-- MANUAL: -->
