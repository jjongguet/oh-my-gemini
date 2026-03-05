import type {
  GeminiProvider,
  GeminiProviderConfigInput,
  GeminiProviderResolvedConfig,
} from './types.js';

const PROJECT_ENV_KEYS = [
  'VERTEX_AI_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
  'GCP_PROJECT',
] as const;
const LOCATION_ENV_KEYS = ['VERTEX_AI_LOCATION', 'GOOGLE_CLOUD_LOCATION'] as const;
const ACCESS_TOKEN_ENV_KEYS = ['VERTEX_AI_ACCESS_TOKEN', 'GOOGLE_OAUTH_ACCESS_TOKEN'] as const;
const DEFAULT_LOCATION = 'us-central1';

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
  const withoutPublisherPrefix = trimmed.replace(
    /^projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\//,
    '',
  );
  const withoutModelsPrefix = withoutPublisherPrefix.replace(/^models\//, '');

  if (!withoutModelsPrefix) {
    throw new Error('Vertex AI provider: model id is required');
  }

  return withoutModelsPrefix;
}

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function hasGoogleApplicationCredentials(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}

export class VertexAiProvider implements GeminiProvider {
  readonly name = 'vertex-ai' as const;
  readonly displayName = 'Google Vertex AI';
  readonly aliases = ['vertex', 'vertexai', 'gcp'] as const;
  readonly defaultApiVersion = 'v1';

  detectFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
    if (parseBoolean(env.GOOGLE_GENAI_USE_VERTEXAI)) {
      return true;
    }

    return readFirstNonEmptyEnv(env, PROJECT_ENV_KEYS) !== undefined;
  }

  checkAuth(env: NodeJS.ProcessEnv = process.env): boolean {
    return (
      readFirstNonEmptyEnv(env, ACCESS_TOKEN_ENV_KEYS) !== undefined
      || hasGoogleApplicationCredentials(env)
    );
  }

  resolveConfig(input: GeminiProviderConfigInput = {}): GeminiProviderResolvedConfig {
    const env = input.env ?? process.env;

    const projectId = input.projectId?.trim() || readFirstNonEmptyEnv(env, PROJECT_ENV_KEYS);
    if (!projectId) {
      throw new Error(
        'Vertex AI provider requires VERTEX_AI_PROJECT_ID or GOOGLE_CLOUD_PROJECT (or explicit projectId).',
      );
    }

    const location =
      input.location?.trim()
      || readFirstNonEmptyEnv(env, LOCATION_ENV_KEYS)
      || DEFAULT_LOCATION;
    const apiVersion = input.apiVersion?.trim() || this.defaultApiVersion;
    const baseUrl =
      input.baseUrl?.trim()
      || `https://${encodeURIComponent(location)}-aiplatform.googleapis.com`;

    assertHttpUrl(baseUrl, 'Vertex AI provider base URL');

    return {
      provider: this.name,
      apiVersion,
      baseUrl,
      projectId,
      location,
      accessToken: input.accessToken?.trim() || readFirstNonEmptyEnv(env, ACCESS_TOKEN_ENV_KEYS),
    };
  }

  buildGenerateContentUrl(model: string, config: GeminiProviderResolvedConfig): string {
    const normalizedModel = normalizeModelId(model);
    const baseUrl = assertHttpUrl(config.baseUrl, 'Vertex AI provider base URL');
    const projectId = config.projectId?.trim();
    const location = config.location?.trim() || DEFAULT_LOCATION;

    if (!projectId) {
      throw new Error('Vertex AI provider requires projectId to build API URL.');
    }

    const pathnamePrefix = baseUrl.pathname.replace(/\/$/, '');
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedLocation = encodeURIComponent(location);
    const encodedModel = encodeURIComponent(normalizedModel);

    baseUrl.pathname =
      `${pathnamePrefix}/${config.apiVersion}/projects/${encodedProjectId}`
      + `/locations/${encodedLocation}/publishers/google/models/${encodedModel}:generateContent`;

    return baseUrl.toString();
  }

  buildRequestHeaders(config: GeminiProviderResolvedConfig): Record<string, string> {
    const token = config.accessToken?.trim();
    if (!token) {
      throw new Error(
        'Vertex AI provider requires VERTEX_AI_ACCESS_TOKEN (or explicit accessToken) for REST requests.',
      );
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }
}
