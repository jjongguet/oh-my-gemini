<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# e2e

## Purpose
End-to-end tests that exercise real external integrations and full OMG lifecycle flows, including live Gemini API calls when credentials are available.

## Key Files

| File | Description |
|------|-------------|
| `gemini-api-lifecycle.test.ts` | Live Gemini API lifecycle test covering worker context, task claims, heartbeats, completion, and skill/dispatch integration. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep these tests explicitly gated behind required environment variables and isolate side effects inside temp directories.
- Prefer broad lifecycle assertions over brittle implementation-specific details.

### Testing Requirements
- Run `npm run test:e2e` only when the required live credentials and tooling (for example `GEMINI_API_KEY`) are present.
- Ensure skips remain deterministic when secrets are unavailable.

### Common Patterns
- Real API calls, temp workspace setup, and verification of persisted state/control-plane artifacts.

## Dependencies

### Internal
- Touches providers, hooks, state store, team control plane, and test utilities across the repository.

### External
- Live Gemini API access via `GEMINI_API_KEY`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
