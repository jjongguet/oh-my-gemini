import type {
  GeminiModelConfiguration,
  GeminiModelTier,
  GeminiProviderName,
  GeminiTierModelMap,
} from './types.js';

export type SupportedGeminiProvider = Exclude<GeminiProviderName, 'unknown'>;

const BUILTIN_TIER_MODELS: Record<SupportedGeminiProvider, GeminiTierModelMap> = {
  'google-ai': {
    low: 'gemini-3.1-flash-lite-preview',
    medium: 'gemini-3.1-flash-lite-preview',
    high: 'gemini-3.1-flash-lite-preview',
  },
  'vertex-ai': {
    low: 'gemini-3.1-flash-lite-preview',
    medium: 'gemini-3.1-flash-lite-preview',
    high: 'gemini-3.1-flash-lite-preview',
  },
};

const BUILTIN_MODEL_CONFIGS: Record<SupportedGeminiProvider, ReadonlyArray<GeminiModelConfiguration>> = {
  'google-ai': [
    // Gemini 3.1 models (current defaults)
    {
      id: 'gemini-3.1-pro-preview',
      provider: 'google-ai',
      displayName: 'Gemini 3.1 Pro',
      tier: 'high',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      provider: 'google-ai',
      displayName: 'Gemini 3 Flash',
      tier: 'medium',
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      provider: 'google-ai',
      displayName: 'Gemini 3.1 Flash-Lite',
      tier: 'low',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    // Gemini 3 models (backward compatibility)
    {
      id: 'gemini-3-pro',
      provider: 'google-ai',
      displayName: 'Gemini 3 Pro',
      tier: 'high',
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3-flash',
      provider: 'google-ai',
      displayName: 'Gemini 3 Flash',
      tier: 'medium',
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3-flash-lite',
      provider: 'google-ai',
      displayName: 'Gemini 3 Flash-Lite',
      tier: 'low',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 16_384,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    // Gemini 2.5 models (backward compatibility)
    {
      id: 'gemini-2.5-pro',
      provider: 'google-ai',
      displayName: 'Gemini 2.5 Pro',
      tier: 'high',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-2.5-flash',
      provider: 'google-ai',
      displayName: 'Gemini 2.5 Flash',
      tier: 'medium',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-2.5-flash-lite',
      provider: 'google-ai',
      displayName: 'Gemini 2.5 Flash-Lite',
      tier: 'low',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 8_192,
      supportsVision: false,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
  ],
  'vertex-ai': [
    // Gemini 3.1 models (current defaults)
    {
      id: 'gemini-3.1-pro-preview',
      provider: 'vertex-ai',
      displayName: 'Gemini 3.1 Pro (Vertex AI)',
      tier: 'high',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      provider: 'vertex-ai',
      displayName: 'Gemini 3 Flash (Vertex AI)',
      tier: 'medium',
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      provider: 'vertex-ai',
      displayName: 'Gemini 3.1 Flash-Lite (Vertex AI)',
      tier: 'low',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    // Gemini 3 models (backward compatibility)
    {
      id: 'gemini-3-pro',
      provider: 'vertex-ai',
      displayName: 'Gemini 3 Pro (Vertex AI)',
      tier: 'high',
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3-flash',
      provider: 'vertex-ai',
      displayName: 'Gemini 3 Flash (Vertex AI)',
      tier: 'medium',
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-3-flash-lite',
      provider: 'vertex-ai',
      displayName: 'Gemini 3 Flash-Lite (Vertex AI)',
      tier: 'low',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 16_384,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    // Gemini 2.5 models (backward compatibility)
    {
      id: 'gemini-2.5-pro',
      provider: 'vertex-ai',
      displayName: 'Gemini 2.5 Pro (Vertex AI)',
      tier: 'high',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-2.5-flash',
      provider: 'vertex-ai',
      displayName: 'Gemini 2.5 Flash (Vertex AI)',
      tier: 'medium',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 65_536,
      supportsVision: true,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
    {
      id: 'gemini-2.5-flash-lite',
      provider: 'vertex-ai',
      displayName: 'Gemini 2.5 Flash-Lite (Vertex AI)',
      tier: 'low',
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 8_192,
      supportsVision: false,
      supportsToolUse: true,
      supportsStructuredOutput: true,
    },
  ],
};

const MODEL_TIERS: readonly GeminiModelTier[] = ['low', 'medium', 'high'];

function normalizeModelId(model: string): string {
  return model.trim().replace(/^\/+/, '').replace(/^models\//, '').toLowerCase();
}

function normalizeProviderEnvToken(provider: SupportedGeminiProvider): string {
  return provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function readFirstNonEmptyEnv(
  env: NodeJS.ProcessEnv,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getTierOverrideEnvKeys(
  provider: SupportedGeminiProvider,
  tier: GeminiModelTier,
): string[] {
  const upperTier = tier.toUpperCase();
  const providerToken = normalizeProviderEnvToken(provider);

  return [
    `OMP_GEMINI_MODEL_${providerToken}_${upperTier}`,
    `OMP_GEMINI_MODEL_${upperTier}`,
    `GEMINI_MODEL_${upperTier}`,
    `OMP_MODEL_${upperTier}`,
  ];
}

export function getBuiltInTierModelMap(provider: SupportedGeminiProvider): GeminiTierModelMap {
  const defaults = BUILTIN_TIER_MODELS[provider];
  return { ...defaults };
}

export function resolveTierModels(
  provider: SupportedGeminiProvider,
  env: NodeJS.ProcessEnv = process.env,
): GeminiTierModelMap {
  const builtInDefaults = BUILTIN_TIER_MODELS[provider];

  return {
    low:
      readFirstNonEmptyEnv(env, getTierOverrideEnvKeys(provider, 'low'))
      ?? builtInDefaults.low,
    medium:
      readFirstNonEmptyEnv(env, getTierOverrideEnvKeys(provider, 'medium'))
      ?? builtInDefaults.medium,
    high:
      readFirstNonEmptyEnv(env, getTierOverrideEnvKeys(provider, 'high'))
      ?? builtInDefaults.high,
  };
}

export function resolveModelForTier(
  tier: GeminiModelTier,
  provider: SupportedGeminiProvider,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveTierModels(provider, env)[tier];
}

export function listModelConfigurations(
  provider?: SupportedGeminiProvider,
): GeminiModelConfiguration[] {
  if (provider) {
    return [...BUILTIN_MODEL_CONFIGS[provider]];
  }

  return [
    ...BUILTIN_MODEL_CONFIGS['google-ai'],
    ...BUILTIN_MODEL_CONFIGS['vertex-ai'],
  ];
}

export function getModelConfiguration(
  modelId: string,
  provider?: SupportedGeminiProvider,
): GeminiModelConfiguration | null {
  const normalizedId = normalizeModelId(modelId);
  if (!normalizedId) {
    return null;
  }

  const candidates = provider
    ? BUILTIN_MODEL_CONFIGS[provider]
    : [...BUILTIN_MODEL_CONFIGS['google-ai'], ...BUILTIN_MODEL_CONFIGS['vertex-ai']];

  return (
    candidates.find((entry) => normalizeModelId(entry.id) === normalizedId)
    ?? null
  );
}

export function isKnownModel(
  modelId: string,
  provider?: SupportedGeminiProvider,
): boolean {
  return getModelConfiguration(modelId, provider) !== null;
}

export function listModelTiers(): readonly GeminiModelTier[] {
  return MODEL_TIERS;
}
