<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25T05:26:01Z | Updated: 2026-03-11T06:39:43Z -->

# docs

## Purpose
Human-readable project documentation covering canonical architecture, analysis, planning, setup, testing, examples, OMG reference material, static assets, and archived historical material.

## Key Files

| File | Description |
|------|-------------|
| `ARCHITECTURE.md` | High-level architecture overview that complements the deeper docs subtrees. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `analysis/` | Canonical decision, parity, and migration analysis documents (see `analysis/AGENTS.md`). |
| `api/` | Reference documentation for commands, modules, and public-facing surfaces (see `api/AGENTS.md`). |
| `architecture/` | Boundary, contract, and backend design documentation (see `architecture/AGENTS.md`). |
| `archive/` | Historical or superseded documentation preserved for traceability (see `archive/AGENTS.md`). |
| `assets/` | Static documentation assets such as logos and images (see `assets/AGENTS.md`). |
| `examples/` | Worked examples and workflow walkthroughs (see `examples/AGENTS.md`). |
| `omg/` | OMG-specific reference docs for commands, boundaries, and project mapping (see `omg/AGENTS.md`). |
| `planning/` | Active canonical planning, rollout, gate, and decomposition documents (see `planning/AGENTS.md`). |
| `setup/` | Installation and onboarding runbooks (see `setup/AGENTS.md`). |
| `testing/` | Verification gates and live operational test runbooks (see `testing/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep docs synchronized with the current command surface, packaged assets, and implementation behavior.
- Separate canonical guidance from archive material; move superseded alternatives into `docs/archive/` instead of mixing them into active folders.
- Prefer copy-paste-safe commands and explicit path references.

### Testing Requirements
- Validate command examples, filenames, and relative links after editing docs.
- When code behavior changes, update the corresponding docs in the same change set.

### Common Patterns
- Active docs are organized by concern; historical material is isolated under `archive/`.
- Decision and planning docs commonly use date-prefixed filenames for traceability.

## Dependencies

### Internal
- Reflects behavior implemented under `src/`, `commands/`, `skills/`, `scripts/`, and `tests/`.
- Canonical planning and analysis docs should be preferred over historical `.omx` or archived working notes.

### External
- Markdown docs consumed by contributors, operators, and AI agents.

<!-- MANUAL: -->
