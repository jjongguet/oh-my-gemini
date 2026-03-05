import type {
  GeminiProvider,
  GeminiProviderConfigInput,
  GeminiProviderResolvedConfig,
} from './types.js';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const API_KEY_ENV_KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] as const;

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

function assertHttpUrl(rawUrl: string, context: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${context}: invalid URL (${rawUrl})`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${context}: URL must use http or https (${rawUrl})`);
  }

  return parsed;
}

function normalizeModelId(model: string): string {
  const trimmed = model.trim().replace(/^\/+/, '');
  const withoutPrefix = trimmed.replace(/^models\//, '');
  if (!withoutPrefix) {
    throw new Error('Google AI provider: model id is required');
  }

  return withoutPrefix;
}

export class GoogleAiProvider implements GeminiProvider {
  readonly name = 'google-ai' as const;
  readonly displayName = 'Google AI Studio';
  readonly aliases = ['google', 'ai-studio', 'aistudio'] as const;
  readonly defaultApiVersion = 'v1beta';

  detectFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
    return this.checkAuth(env);
  }

  checkAuth(env: NodeJS.ProcessEnv = process.env): boolean {
    return readFirstNonEmptyEnv(env, API_KEY_ENV_KEYS) !== undefined;
  }

  resolveConfig(input: GeminiProviderConfigInput = {}): GeminiProviderResolvedConfig {
    const env = input.env ?? process.env;
    const apiKey = input.apiKey?.trim() || readFirstNonEmptyEnv(env, API_KEY_ENV_KEYS);

    if (!apiKey) {
      throw new Error(
        'Google AI provider requires GEMINI_API_KEY or GOOGLE_API_KEY (or explicit apiKey).',
      );
    }

    const apiVersion = input.apiVersion?.trim() || this.defaultApiVersion;
    const baseUrl = input.baseUrl?.trim() || DEFAULT_BASE_URL;

    assertHttpUrl(baseUrl, 'Google AI provider base URL');

    return {
      provider: this.name,
      apiVersion,
      baseUrl,
      apiKey,
    };
  }

  buildGenerateContentUrl(model: string, config: GeminiProviderResolvedConfig): string {
    const normalizedModel = normalizeModelId(model);
    const baseUrl = assertHttpUrl(config.baseUrl, 'Google AI provider base URL');
    const pathnamePrefix = baseUrl.pathname.replace(/\/$/, '');
    const encodedModel = encodeURIComponent(normalizedModel);

    baseUrl.pathname = `${pathnamePrefix}/${config.apiVersion}/models/${encodedModel}:generateContent`;
    baseUrl.searchParams.set('key', config.apiKey ?? '');

    return baseUrl.toString();
  }

  buildRequestHeaders(): Record<string, string> {
    return {};
  }
}
