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
  BUILTIN_MODEL_HIGH,
  BUILTIN_MODEL_LOW,
  BUILTIN_MODEL_MEDIUM,
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
  OmgAgentConfig,
  OmgConfig,
  OmgExternalModelsConfig,
  OmgFeatureFlags,
  OmgGeminiProviderConfig,
  OmgPermissionConfig,
  OmgProvidersConfig,
  OmgRoutingConfig,
  OmgRoutingOverride,
} from './types.js';
