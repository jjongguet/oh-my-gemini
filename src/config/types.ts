export type ComplexityTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type ExternalModelProvider = 'gemini' | 'codex';

export interface OmpAgentConfig {
  model: string;
}

export interface OmpFeatureFlags {
  parallelExecution: boolean;
  continuationEnforcement: boolean;
  autoContextInjection: boolean;
  commandTemplates: boolean;
  runtimePlugins: boolean;
}

export interface OmpPermissionConfig {
  allowBash: boolean;
  allowEdit: boolean;
  allowWrite: boolean;
  maxBackgroundTasks: number;
}

export interface OmpRoutingOverride {
  tier: ComplexityTier;
  reason?: string;
}

export interface OmpRoutingConfig {
  enabled: boolean;
  defaultTier: ComplexityTier;
  forceInherit: boolean;
  escalationEnabled: boolean;
  maxEscalations: number;
  tierModels: Record<ComplexityTier, string>;
  agentOverrides: Record<string, OmpRoutingOverride>;
  escalationKeywords: string[];
  simplificationKeywords: string[];
}

export interface OmpGeminiRetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface OmpGeminiProviderConfig {
  enabled: boolean;
  apiKeyEnvVar: string;
  baseUrl?: string;
  defaultModel: string;
  apiVersion?: string;
  requestTimeoutMs?: number;
  retry?: OmpGeminiRetryConfig;
}

export interface OmpProvidersConfig {
  gemini: OmpGeminiProviderConfig;
}

export interface OmpExternalModelsConfig {
  defaults: {
    provider?: ExternalModelProvider;
    codexModel: string;
    geminiModel: string;
  };
  fallbackPolicy: {
    onModelFailure: 'provider_chain' | 'cross_provider' | 'gemini_only';
    allowCrossProvider: boolean;
    crossProviderOrder: ExternalModelProvider[];
  };
}

export interface OmpRecoveryConfig {
  maxWorkerRestarts: number;
  restartPolicy: 'on-failure' | 'never';
}

export interface OmpConfig {
  agents: Record<string, OmpAgentConfig>;
  features: OmpFeatureFlags;
  permissions: OmpPermissionConfig;
  routing: OmpRoutingConfig;
  providers: OmpProvidersConfig;
  externalModels: OmpExternalModelsConfig;
  recovery: OmpRecoveryConfig;
}
