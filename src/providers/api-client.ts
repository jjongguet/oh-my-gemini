import { GoogleAiProvider } from './google-ai.js';
import { VertexAiProvider } from './vertex-ai.js';
import type {
  GeminiProvider,
  GeminiProviderConfigInput,
  GeminiProviderName,
  GeminiProviderResolvedConfig,
} from './types.js';
import type { OmpGeminiProviderConfig } from '../config/types.js';

const PROVIDER_ENV_KEYS = ['OMP_GEMINI_PROVIDER', 'GEMINI_PROVIDER'] as const;
const GOOGLE_API_KEY_ENV_KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] as const;
const VERTEX_PROJECT_ENV_KEYS = [
  'VERTEX_AI_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
  'GCP_PROJECT',
] as const;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const THINKING_MODEL_REQUEST_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_ENV_KEYS = ['OMP_REQUEST_TIMEOUT_MS', 'GEMINI_REQUEST_TIMEOUT_MS'] as const;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 30_000;

const THINKING_MODEL_PATTERNS = [
  'thinking',
  'think',
] as const;

const BUILTIN_PROVIDERS: Record<Exclude<GeminiProviderName, 'unknown'>, GeminiProvider> = {
  'google-ai': new GoogleAiProvider(),
  'vertex-ai': new VertexAiProvider(),
};

export type GeminiApiFetch = typeof fetch;

export interface GeminiContent {
  role?: string;
  parts: Array<Record<string, unknown>>;
}

export interface GeminiGenerateContentRequest {
  model: string;
  contents: GeminiContent[];
  systemInstruction?: GeminiContent | string;
  generationConfig?: Record<string, unknown>;
  safetySettings?: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  toolConfig?: Record<string, unknown>;
  cachedContent?: string;
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<Record<string, unknown>>;
  promptFeedback?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
  modelVersion?: string;
  [key: string]: unknown;
}

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface GeminiApiClientOptions {
  provider?: GeminiProviderName | GeminiProvider;
  providerConfig?: GeminiProviderConfigInput;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: GeminiApiFetch;
  requestTimeoutMs?: number;
  retry?: RetryConfig;
}

export interface GeminiGenerateContentCallOptions {
  providerConfig?: GeminiProviderConfigInput;
}

export class GeminiApiClientError extends Error {
  readonly provider: GeminiProviderName;
  readonly statusCode?: number;
  readonly responseBody?: string;

  constructor(
    message: string,
    options: {
      provider: GeminiProviderName;
      statusCode?: number;
      responseBody?: string;
      cause?: unknown;
    },
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'GeminiApiClientError';
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
  }
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

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function parseProviderName(raw: string): GeminiProviderName {
  const normalized = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');

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

function detectProviderFromEnv(env: NodeJS.ProcessEnv): GeminiProviderName {
  const override = readFirstNonEmptyEnv(env, PROVIDER_ENV_KEYS);
  if (override) {
    const parsed = parseProviderName(override);
    if (parsed !== 'unknown') {
      return parsed;
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

function resolveProvider(
  providerInput: GeminiProviderName | GeminiProvider | undefined,
  env: NodeJS.ProcessEnv,
): GeminiProvider {
  if (providerInput && typeof providerInput === 'object') {
    return providerInput;
  }

  if (typeof providerInput === 'string') {
    const parsed = parseProviderName(providerInput);
    if (parsed === 'unknown') {
      throw new GeminiApiClientError(`Unsupported Gemini provider: ${providerInput}`, {
        provider: 'unknown',
      });
    }

    return BUILTIN_PROVIDERS[parsed];
  }

  const detectedProvider = detectProviderFromEnv(env);
  if (detectedProvider === 'unknown') {
    throw new GeminiApiClientError(
      'Unable to detect Gemini provider from environment. Set OMP_GEMINI_PROVIDER, GEMINI_API_KEY, or Vertex AI project variables.',
      {
        provider: 'unknown',
      },
    );
  }

  return BUILTIN_PROVIDERS[detectedProvider];
}

export function isThinkingModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase();
  return THINKING_MODEL_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function resolveTimeoutFromEnv(env: NodeJS.ProcessEnv): number | undefined {
  const raw = readFirstNonEmptyEnv(env, REQUEST_TIMEOUT_ENV_KEYS);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function getDefaultTimeoutForModel(modelId: string): number {
  return isThinkingModel(modelId) ? THINKING_MODEL_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (!Number.isInteger(timeoutMs) || (timeoutMs ?? 0) <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return timeoutMs as number;
}

function toSystemInstruction(
  systemInstruction: GeminiGenerateContentRequest['systemInstruction'],
): GeminiContent | undefined {
  if (systemInstruction === undefined) {
    return undefined;
  }

  if (typeof systemInstruction === 'string') {
    return {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    };
  }

  return systemInstruction;
}

function assertGenerateContentInput(input: GeminiGenerateContentRequest): void {
  if (!input.model || input.model.trim().length === 0) {
    throw new GeminiApiClientError('Gemini API request requires a non-empty model id.', {
      provider: 'unknown',
    });
  }

  if (!Array.isArray(input.contents) || input.contents.length === 0) {
    throw new GeminiApiClientError('Gemini API request requires at least one content item.', {
      provider: 'unknown',
    });
  }
}

function createPayload(input: GeminiGenerateContentRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    contents: input.contents,
  };

  const systemInstruction = toSystemInstruction(input.systemInstruction);
  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }

  if (input.generationConfig) {
    payload.generationConfig = input.generationConfig;
  }

  if (input.safetySettings) {
    payload.safetySettings = input.safetySettings;
  }

  if (input.tools) {
    payload.tools = input.tools;
  }

  if (input.toolConfig) {
    payload.toolConfig = input.toolConfig;
  }

  if (input.cachedContent) {
    payload.cachedContent = input.cachedContent;
  }

  return payload;
}

function mergeProviderConfig(
  baseConfig: GeminiProviderConfigInput | undefined,
  callConfig: GeminiProviderConfigInput | undefined,
  env: NodeJS.ProcessEnv,
): GeminiProviderConfigInput {
  return {
    env,
    ...baseConfig,
    ...callConfig,
  };
}

function formatStatusError(
  providerName: GeminiProviderName,
  response: Response,
  responseBody: string,
): GeminiApiClientError {
  return new GeminiApiClientError(
    `Gemini API request failed (${response.status} ${response.statusText})`,
    {
      provider: providerName,
      statusCode: response.status,
      responseBody,
    },
  );
}

function safeParseJson(
  responseBody: string,
  providerName: GeminiProviderName,
): GeminiGenerateContentResponse {
  if (!responseBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(responseBody) as GeminiGenerateContentResponse;
  } catch (error) {
    throw new GeminiApiClientError('Gemini API returned invalid JSON.', {
      provider: providerName,
      responseBody,
      cause: error,
    });
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function computeBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * initialDelayMs;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

function parseRetryAfterHeader(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) {
    const delayMs = dateMs - Date.now();
    return delayMs > 0 ? delayMs : undefined;
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiApiClient {
  private readonly provider: GeminiProvider;
  private readonly env: NodeJS.ProcessEnv;
  private readonly providerConfig?: GeminiProviderConfigInput;
  private readonly fetchImpl: GeminiApiFetch;
  private readonly explicitTimeoutMs: number | undefined;
  private readonly envTimeoutMs: number | undefined;
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: GeminiApiClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.provider = resolveProvider(options.provider, this.env);
    this.providerConfig = options.providerConfig;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.explicitTimeoutMs = (Number.isInteger(options.requestTimeoutMs) && (options.requestTimeoutMs ?? 0) > 0)
      ? options.requestTimeoutMs
      : undefined;
    this.envTimeoutMs = resolveTimeoutFromEnv(this.env);
    this.maxRetries = options.retry?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialDelayMs = options.retry?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
    this.maxDelayMs = options.retry?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  resolveRequestTimeoutMs(modelId: string): number {
    if (this.explicitTimeoutMs !== undefined) {
      return this.explicitTimeoutMs;
    }

    if (this.envTimeoutMs !== undefined) {
      return this.envTimeoutMs;
    }

    return getDefaultTimeoutForModel(modelId);
  }

  get providerName(): GeminiProviderName {
    return this.provider.name;
  }

  private resolveRequestConfig(
    callOptions?: GeminiGenerateContentCallOptions,
  ): GeminiProviderResolvedConfig {
    const mergedConfig = mergeProviderConfig(this.providerConfig, callOptions?.providerConfig, this.env);
    return this.provider.resolveConfig(mergedConfig);
  }

  async generateContent(
    input: GeminiGenerateContentRequest,
    callOptions?: GeminiGenerateContentCallOptions,
  ): Promise<GeminiGenerateContentResponse> {
    assertGenerateContentInput(input);

    const providerConfig = this.resolveRequestConfig(callOptions);
    const url = this.provider.buildGenerateContentUrl(input.model, providerConfig);
    const requestHeaders = {
      'content-type': 'application/json',
      ...this.provider.buildRequestHeaders(providerConfig),
    };
    const payload = createPayload(input);
    const body = JSON.stringify(payload);

    let lastError: GeminiApiClientError | undefined;
    const requestTimeoutMs = this.resolveRequestTimeoutMs(input.model);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0 && lastError) {
        const delayMs = computeBackoffDelay(attempt - 1, this.initialDelayMs, this.maxDelayMs);
        await sleep(delayMs);
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, requestTimeoutMs);

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: requestHeaders,
          body,
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        lastError = new GeminiApiClientError('Gemini API request failed before receiving a response.', {
          provider: this.provider.name,
          cause: error,
        });
        continue;
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (!response.ok && isRetryableStatus(response.status) && attempt < this.maxRetries) {
        const responseBody = await response.text();
        lastError = formatStatusError(this.provider.name, response, responseBody);

        const retryAfterMs = parseRetryAfterHeader(response);
        if (retryAfterMs !== undefined) {
          const clampedDelay = Math.min(retryAfterMs, this.maxDelayMs);
          await sleep(clampedDelay);
          continue;
        }

        continue;
      }

      const responseBody = await response.text();
      if (!response.ok) {
        throw formatStatusError(this.provider.name, response, responseBody);
      }

      return safeParseJson(responseBody, this.provider.name);
    }

    throw lastError!;
  }
}

export function createGeminiApiClient(options: GeminiApiClientOptions = {}): GeminiApiClient {
  return new GeminiApiClient(options);
}

export function createGeminiApiClientFromConfig(
  providerConfig: OmpGeminiProviderConfig,
  overrides: Omit<GeminiApiClientOptions, 'requestTimeoutMs' | 'retry'> = {},
): GeminiApiClient {
  return new GeminiApiClient({
    ...overrides,
    requestTimeoutMs: providerConfig.requestTimeoutMs,
    retry: providerConfig.retry,
  });
}
