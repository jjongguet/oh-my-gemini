<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# analysis

## Purpose
Canonical analysis documents covering adoption decisions, parity requirements, migration constraints, capability deltas, and orchestration design findings.

## Key Files

| File | Description |
|------|-------------|
| `2026-03-02-omg-native-canonical-01-decision-and-principles.md` | Decision framework and core principles for the OMG-native direction. |
| `2026-03-02-omg-native-canonical-02-capability-parity-requirements.md` | Canonical capability and parity requirements. |
| `2026-03-02-omg-native-canonical-03-architecture-and-migration-constraints.md` | Target architecture and migration constraint analysis. |
| `2026-03-02-omg-omc-omx-capability-delta-matrix.md` | Capability delta comparison across related toolchains. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep this folder for current canonical analysis rather than superseded drafts or worker-specific experiments.
- Ground analysis claims in current code, command behavior, and the active planning docs.

### Testing Requirements
- Verify major assertions against the current repository before editing canonical analysis files.
- Update paired planning or architecture docs when analysis changes alter implementation expectations.

### Common Patterns
- Date-prefixed markdown documents.
- Decision memos, delta matrices, and synthesis notes that feed canonical planning.

## Dependencies

### Internal
- Feeds `docs/planning/` and should stay consistent with `docs/architecture/` and current implementation under `src/`.
- Historical alternatives belong under `docs/archive/`.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
