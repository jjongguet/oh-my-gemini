<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-02-28T00:28:25Z -->

# architecture

## Purpose
Documents implementation boundaries and runtime backend contracts for the orchestration system.

## Key Files

| File | Description |
|------|-------------|
| `boundaries.md` | Defines extension/public surface vs internal services and verification layers. |
| `runtime-backend.md` | Specifies backend interface, policies, error semantics, and reliability expectations. |
| `role-skill-contract.md` | Canonical skill-token to role-id mapping and deterministic fallback order. |

## Subdirectories
No subdirectories.

## For AI Agents

### Working In This Directory
- Align terminology with source types (`RuntimeBackend`, lifecycle phases, health monitor semantics).
- Keep backend policy statements consistent with actual defaults (`tmux`) and opt-in behavior (`subagents`).

### Testing Requirements
- For behavioral contract edits, run reliability tests and relevant integration suites.

### Common Patterns
- Architecture docs are contract-first and map directly to source paths.

## Dependencies

### Internal
- Mirrors code in `src/team/**` and `src/state/**`.

### External
- None.

<!-- MANUAL: -->
