import { GoogleAiProvider } from './google-ai.js';
import {
  getBuiltInTierModelMap,
  getModelConfiguration,
  isKnownModel,
  listModelConfigurations,
  listModelTiers,
  resolveModelForTier,
  resolveTierModels,
  type SupportedGeminiProvider,
} from './model-config.js';
import { VertexAiProvider } from './vertex-ai.js';
import type { GeminiProvider, GeminiProviderName } from './types.js';

const PROVIDER_ENV_KEYS = ['OMG_GEMINI_PROVIDER', 'GEMINI_PROVIDER'] as const;
const GOOGLE_API_KEY_ENV_KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] as const;
const VERTEX_PROJECT_ENV_KEYS = [
  'VERTEX_AI_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
  'GCP_PROJECT',
] as const;

let providerRegistry: Map<GeminiProviderName, GeminiProvider> | null = null;

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

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function normalizeProviderToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function initRegistry(): Map<GeminiProviderName, GeminiProvider> {
  if (providerRegistry) {
    return providerRegistry;
  }

  providerRegistry = new Map<GeminiProviderName, GeminiProvider>([
    ['google-ai', new GoogleAiProvider()],
    ['vertex-ai', new VertexAiProvider()],
  ]);

  return providerRegistry;
}

export function listProviders(): GeminiProvider[] {
  return [...initRegistry().values()];
}

export function parseProviderName(raw: string): GeminiProviderName {
  const normalized = normalizeProviderToken(raw);

  if (normalized === 'google-ai' || normalized === 'google') {
    return 'google-ai';
  }

  if (
    normalized === 'vertex-ai'
    || normalized === 'vertex'
    || normalized === 'vertexai'
    || normalized === 'gcp'
  ) {
    return 'vertex-ai';
  }

  return 'unknown';
}

export function detectProviderFromBaseUrl(baseUrl: string): GeminiProviderName {
  try {
    const parsed = new URL(baseUrl.trim());
    const host = parsed.hostname.toLowerCase();

    if (host === 'generativelanguage.googleapis.com') {
      return 'google-ai';
    }

    if (host.endsWith('-aiplatform.googleapis.com') || host === 'aiplatform.googleapis.com') {
      return 'vertex-ai';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function detectProviderFromEnv(env: NodeJS.ProcessEnv = process.env): GeminiProviderName {
  const providerOverride = readFirstNonEmptyEnv(env, PROVIDER_ENV_KEYS);
  if (providerOverride) {
    const parsedProvider = parseProviderName(providerOverride);
    if (parsedProvider !== 'unknown') {
      return parsedProvider;
    }
  }

  if (parseBoolean(env.GOOGLE_GENAI_USE_VERTEXAI)) {
    return 'vertex-ai';
  }

  if (readFirstNonEmptyEnv(env, GOOGLE_API_KEY_ENV_KEYS)) {
    return 'google-ai';
  }

  if (readFirstNonEmptyEnv(env, VERTEX_PROJECT_ENV_KEYS)) {
    return 'vertex-ai';
  }

  return 'unknown';
}

export function getProvider(name: GeminiProviderName): GeminiProvider | null {
  if (name === 'unknown') {
    return null;
  }

  return initRegistry().get(name) ?? null;
}

export function getProviderFromEnv(env: NodeJS.ProcessEnv = process.env): GeminiProvider | null {
  return getProvider(detectProviderFromEnv(env));
}

export function requireProvider(name: GeminiProviderName): GeminiProvider {
  const provider = getProvider(name);
  if (!provider) {
    throw new Error(`Unsupported Gemini provider: ${name}`);
  }

  return provider;
}

export {
  getBuiltInTierModelMap,
  getModelConfiguration,
  isKnownModel,
  listModelConfigurations,
  listModelTiers,
  resolveModelForTier,
  resolveTierModels,
  GoogleAiProvider,
  VertexAiProvider,
};

export type {
  GeminiModelConfiguration,
  GeminiModelTier,
  GeminiProvider,
  GeminiProviderConfigInput,
  GeminiProviderName,
  GeminiProviderResolvedConfig,
  GeminiTierModelMap,
} from './types.js';

export type {
  SupportedGeminiProvider,
};
