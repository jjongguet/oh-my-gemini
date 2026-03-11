<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-11T06:39:43Z | Updated: 2026-03-11T06:39:43Z -->

# providers

## Purpose
Gemini provider abstraction, shared API client logic, provider-specific implementations, and model-tier resolution helpers.

## Key Files

| File | Description |
|------|-------------|
| `api-client.ts` | Shared Gemini API request, retry, and timeout client. |
| `google-ai.ts` | Google AI provider implementation. |
| `vertex-ai.ts` | Vertex AI provider implementation. |
| `model-config.ts` | Provider-specific model tier and alias resolution. |
| `types.ts` | Provider and model-configuration contracts. |

## Subdirectories

No subdirectories.

## For AI Agents

### Working In This Directory
- Keep provider-specific auth/base URL behavior inside the provider modules and shared HTTP concerns in `api-client.ts`.
- Preserve retry and timeout semantics that reliability tests depend on.

### Testing Requirements
- Run `npm run typecheck` and targeted provider/reliability tests when API client or provider selection behavior changes.

### Common Patterns
- Shared `GeminiApiClient` and type contracts with provider-specific implementations layered above them.

## Dependencies

### Internal
- Builds on config/model types and is used by e2e/runtime flows.

### External
- Gemini provider APIs and their authentication environments.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
