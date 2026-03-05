export type ComplexityTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type ExternalModelProvider = 'gemini' | 'codex';

export interface OmgAgentConfig {
  model: string;
}

export interface OmgFeatureFlags {
  parallelExecution: boolean;
  continuationEnforcement: boolean;
  autoContextInjection: boolean;
  commandTemplates: boolean;
  runtimePlugins: boolean;
}

export interface OmgPermissionConfig {
  allowBash: boolean;
  allowEdit: boolean;
  allowWrite: boolean;
  maxBackgroundTasks: number;
}

export interface OmgRoutingOverride {
  tier: ComplexityTier;
  reason?: string;
}

export interface OmgRoutingConfig {
  enabled: boolean;
  defaultTier: ComplexityTier;
  forceInherit: boolean;
  escalationEnabled: boolean;
  maxEscalations: number;
  tierModels: Record<ComplexityTier, string>;
  agentOverrides: Record<string, OmgRoutingOverride>;
  escalationKeywords: string[];
  simplificationKeywords: string[];
}

export interface OmgGeminiProviderConfig {
  enabled: boolean;
  apiKeyEnvVar: string;
  baseUrl?: string;
  defaultModel: string;
  apiVersion?: string;
}

export interface OmgProvidersConfig {
  gemini: OmgGeminiProviderConfig;
}

export interface OmgExternalModelsConfig {
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

export interface OmgConfig {
  agents: Record<string, OmgAgentConfig>;
  features: OmgFeatureFlags;
  permissions: OmgPermissionConfig;
  routing: OmgRoutingConfig;
  providers: OmgProvidersConfig;
  externalModels: OmgExternalModelsConfig;
}
