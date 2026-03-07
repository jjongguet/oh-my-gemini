export type GeminiProviderName = 'google-ai' | 'vertex-ai' | 'unknown';

export type GeminiModelTier = 'low' | 'medium' | 'high';

export interface GeminiTierModelMap {
  low: string;
  medium: string;
  high: string;
}

export interface GeminiModelConfiguration {
  id: string;
  provider: Exclude<GeminiProviderName, 'unknown'>;
  displayName: string;
  tier: GeminiModelTier;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  supportsVision: boolean;
  supportsToolUse: boolean;
  supportsStructuredOutput: boolean;
}

export interface GeminiProviderConfigInput {
  env?: NodeJS.ProcessEnv;
  apiVersion?: string;
  baseUrl?: string;
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
  location?: string;
}

export interface GeminiProviderResolvedConfig {
  provider: GeminiProviderName;
  apiVersion: string;
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
  location?: string;
}

export interface GeminiProvider {
  readonly name: Exclude<GeminiProviderName, 'unknown'>;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly defaultApiVersion: string;

  detectFromEnv(env?: NodeJS.ProcessEnv): boolean;
  checkAuth(env?: NodeJS.ProcessEnv): boolean;
  resolveConfig(input?: GeminiProviderConfigInput): GeminiProviderResolvedConfig;
  buildGenerateContentUrl(model: string, config: GeminiProviderResolvedConfig): string;
  buildRequestHeaders(config: GeminiProviderResolvedConfig): Record<string, string>;
}
