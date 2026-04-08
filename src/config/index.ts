export {
  deepMerge,
  getConfigPaths,
  loadConfig,
  loadEnvConfig,
  loadJsoncFile,
  type ConfigPaths,
  type LoadConfigOptions,
} from './loader.js';

export {
  BUILTIN_FRONTIER_MODEL,
  BUILTIN_MODEL_HIGH,
  BUILTIN_MODEL_LOW,
  BUILTIN_MODEL_MEDIUM,
  getDefaultExternalModels,
  getDefaultModelHigh,
  getDefaultModelLow,
  getDefaultModelMedium,
  getDefaultTierModels,
  isGoogleGeminiEndpoint,
  isNonGeminiProvider,
} from './models.js';

export type {
  ComplexityTier,
  ExternalModelProvider,
  OmpAgentConfig,
  OmpConfig,
  OmpExternalModelsConfig,
  OmpFeatureFlags,
  OmpGeminiProviderConfig,
  OmpGeminiRetryConfig,
  OmpPermissionConfig,
  OmpProvidersConfig,
  OmpRoutingConfig,
  OmpRoutingOverride,
} from './types.js';
