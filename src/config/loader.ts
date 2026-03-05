import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  getDefaultModelHigh,
  getDefaultModelLow,
  getDefaultModelMedium,
  getDefaultTierModels,
  isNonGeminiProvider,
} from './models.js';
import type {
  ExternalModelProvider,
  ComplexityTier,
  OmgConfig,
} from './types.js';

export interface ConfigPaths {
  user: string;
  project: string;
}

export interface LoadConfigOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  configPaths?: ConfigPaths;
}

function createDefaultConfig(env: NodeJS.ProcessEnv): OmgConfig {
  return {
    agents: {
      planner: { model: getDefaultModelHigh(env) },
      architect: { model: getDefaultModelHigh(env) },
      executor: { model: getDefaultModelMedium(env) },
      verifier: { model: getDefaultModelMedium(env) },
      writer: { model: getDefaultModelLow(env) },
    },
    features: {
      parallelExecution: true,
      continuationEnforcement: true,
      autoContextInjection: true,
      commandTemplates: true,
      runtimePlugins: true,
    },
    permissions: {
      allowBash: true,
      allowEdit: true,
      allowWrite: true,
      maxBackgroundTasks: 5,
    },
    routing: {
      enabled: true,
      defaultTier: 'MEDIUM',
      forceInherit: false,
      escalationEnabled: true,
      maxEscalations: 2,
      tierModels: getDefaultTierModels(env),
      agentOverrides: {
        planner: { tier: 'HIGH', reason: 'Planning requires deeper reasoning.' },
        architect: { tier: 'HIGH', reason: 'Architecture requires deeper reasoning.' },
        writer: { tier: 'LOW', reason: 'Documentation often fits lower-cost tier.' },
      },
      escalationKeywords: [
        'critical',
        'production',
        'security',
        'architecture',
        'refactor',
      ],
      simplificationKeywords: [
        'find',
        'list',
        'show',
        'search',
        'locate',
      ],
    },
    providers: {
      gemini: {
        enabled: true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        baseUrl: env.GEMINI_BASE_URL ?? env.GOOGLE_GENERATIVE_AI_BASE_URL,
        defaultModel: env.GEMINI_MODEL ?? getDefaultModelMedium(env),
        apiVersion: env.GEMINI_API_VERSION,
      },
    },
    externalModels: {
      defaults: {
        codexModel: env.OMG_CODEX_DEFAULT_MODEL ?? 'gpt-5.3-codex',
        geminiModel: env.OMG_GEMINI_DEFAULT_MODEL ?? getDefaultModelMedium(env),
      },
      fallbackPolicy: {
        onModelFailure: 'provider_chain',
        allowCrossProvider: false,
        crossProviderOrder: ['gemini', 'codex'],
      },
    },
  };
}

export function getConfigPaths(cwd: string = process.cwd()): ConfigPaths {
  return {
    user: path.join(homedir(), '.config', 'oh-my-gemini', 'config.jsonc'),
    project: path.join(cwd, '.gemini', 'omg.jsonc'),
  };
}

function parseJsonc(raw: string): unknown {
  const withoutBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, '');
  const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

export function loadJsoncFile(filePath: string): Partial<OmgConfig> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return parseJsonc(readFileSync(filePath, 'utf8')) as Partial<OmgConfig>;
  } catch (error) {
    console.warn(`[config] failed to parse ${filePath}: ${(error as Error).message}`);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge<T extends object>(
  target: T,
  source: Partial<T>,
): T {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

  for (const [key, sourceValue] of Object.entries(source)) {
    if (sourceValue === undefined) {
      continue;
    }

    const targetValue = result[key];
    if (isRecord(targetValue) && isRecord(sourceValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
      continue;
    }

    result[key] = sourceValue;
  }

  return result as T;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseTier(value: string | undefined): ComplexityTier | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH') {
    return normalized;
  }
  return undefined;
}

function parseExternalProvider(value: string | undefined): ExternalModelProvider | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'gemini' || value === 'codex') {
    return value;
  }
  return undefined;
}

function parseProviderOrder(
  value: string | undefined,
): ExternalModelProvider[] | undefined {
  if (!value) {
    return undefined;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is ExternalModelProvider => entry === 'gemini' || entry === 'codex');

  if (entries.length === 0) {
    return undefined;
  }

  const seen = new Set<ExternalModelProvider>();
  const deduped: ExternalModelProvider[] = [];
  for (const entry of entries) {
    if (!seen.has(entry)) {
      seen.add(entry);
      deduped.push(entry);
    }
  }
  return deduped;
}

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): Partial<OmgConfig> {
  const partial: Partial<OmgConfig> = {};

  const featureFlags = {
    parallelExecution: parseBoolean(env.OMG_PARALLEL_EXECUTION),
    continuationEnforcement: parseBoolean(env.OMG_CONTINUATION_ENFORCEMENT),
    autoContextInjection: parseBoolean(env.OMG_AUTO_CONTEXT_INJECTION),
    commandTemplates: parseBoolean(env.OMG_COMMAND_TEMPLATES),
    runtimePlugins: parseBoolean(env.OMG_RUNTIME_PLUGINS),
  };

  if (Object.values(featureFlags).some((value) => value !== undefined)) {
    partial.features = {
      parallelExecution: featureFlags.parallelExecution ?? true,
      continuationEnforcement: featureFlags.continuationEnforcement ?? true,
      autoContextInjection: featureFlags.autoContextInjection ?? true,
      commandTemplates: featureFlags.commandTemplates ?? true,
      runtimePlugins: featureFlags.runtimePlugins ?? true,
    };
  }

  if (env.OMG_MAX_BACKGROUND_TASKS !== undefined) {
    const parsed = Number.parseInt(env.OMG_MAX_BACKGROUND_TASKS, 10);
    if (Number.isFinite(parsed)) {
      partial.permissions = {
        allowBash: true,
        allowEdit: true,
        allowWrite: true,
        maxBackgroundTasks: Math.max(0, parsed),
      };
    }
  }

  const routingEnabled = parseBoolean(env.OMG_ROUTING_ENABLED);
  const forceInherit = parseBoolean(env.OMG_ROUTING_FORCE_INHERIT);
  const escalationEnabled = parseBoolean(env.OMG_ESCALATION_ENABLED);
  const defaultTier = parseTier(env.OMG_ROUTING_DEFAULT_TIER);
  const maxEscalationsRaw = env.OMG_MAX_ESCALATIONS ?? env.OMG_ROUTING_MAX_ESCALATIONS;
  const maxEscalations = maxEscalationsRaw ? Number.parseInt(maxEscalationsRaw, 10) : undefined;

  if (
    routingEnabled !== undefined ||
    forceInherit !== undefined ||
    escalationEnabled !== undefined ||
    defaultTier !== undefined ||
    maxEscalations !== undefined ||
    env.OMG_MODEL_HIGH !== undefined ||
    env.OMG_MODEL_MEDIUM !== undefined ||
    env.OMG_MODEL_LOW !== undefined
  ) {
    partial.routing = {
      enabled: routingEnabled ?? true,
      defaultTier: defaultTier ?? 'MEDIUM',
      forceInherit: forceInherit ?? false,
      escalationEnabled: escalationEnabled ?? true,
      maxEscalations:
        maxEscalations !== undefined && Number.isFinite(maxEscalations) ? Math.max(0, maxEscalations) : 2,
      tierModels: getDefaultTierModels(env),
      agentOverrides: {},
      escalationKeywords: ['critical', 'production', 'security', 'architecture', 'refactor'],
      simplificationKeywords: ['find', 'list', 'show', 'search', 'locate'],
    };
  }

  if (
    env.GEMINI_BASE_URL !== undefined ||
    env.GOOGLE_GENERATIVE_AI_BASE_URL !== undefined ||
    env.GEMINI_MODEL !== undefined ||
    env.GEMINI_API_VERSION !== undefined ||
    env.GEMINI_API_KEY !== undefined ||
    env.OMG_GEMINI_PROVIDER_ENABLED !== undefined
  ) {
    const providerEnabled = parseBoolean(env.OMG_GEMINI_PROVIDER_ENABLED);
    partial.providers = {
      gemini: {
        enabled: providerEnabled ?? true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        baseUrl: env.GEMINI_BASE_URL ?? env.GOOGLE_GENERATIVE_AI_BASE_URL,
        defaultModel: env.GEMINI_MODEL ?? getDefaultModelMedium(env),
        apiVersion: env.GEMINI_API_VERSION,
      },
    };
  }

  const provider = parseExternalProvider(env.OMG_EXTERNAL_MODELS_DEFAULT_PROVIDER);
  const codexModel =
    env.OMG_EXTERNAL_MODELS_DEFAULT_CODEX_MODEL ?? env.OMG_CODEX_DEFAULT_MODEL;
  const geminiModel =
    env.OMG_EXTERNAL_MODELS_DEFAULT_GEMINI_MODEL ?? env.OMG_GEMINI_DEFAULT_MODEL;
  const onModelFailure = env.OMG_EXTERNAL_MODELS_FALLBACK_POLICY;
  const allowCrossProvider = parseBoolean(env.OMG_EXTERNAL_MODELS_ALLOW_CROSS_PROVIDER);
  const crossProviderOrder = parseProviderOrder(env.OMG_EXTERNAL_MODELS_CROSS_PROVIDER_ORDER);

  if (
    provider !== undefined ||
    codexModel !== undefined ||
    geminiModel !== undefined ||
    onModelFailure !== undefined ||
    allowCrossProvider !== undefined ||
    crossProviderOrder !== undefined
  ) {
    partial.externalModels = {
      defaults: {
        ...(provider !== undefined ? { provider } : {}),
        codexModel: codexModel ?? 'gpt-5.3-codex',
        geminiModel: geminiModel ?? getDefaultModelMedium(env),
      },
      fallbackPolicy: {
        onModelFailure:
          onModelFailure === 'provider_chain' ||
            onModelFailure === 'cross_provider' ||
            onModelFailure === 'gemini_only'
            ? onModelFailure
            : 'provider_chain',
        allowCrossProvider: allowCrossProvider ?? false,
        crossProviderOrder: crossProviderOrder ?? ['gemini', 'codex'],
      },
    };
  }

  return partial;
}

export function loadConfig(options: LoadConfigOptions = {}): OmgConfig {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const configPaths = options.configPaths ?? getConfigPaths(cwd);

  let config = createDefaultConfig(env);

  const userConfig = loadJsoncFile(configPaths.user);
  if (userConfig) {
    config = deepMerge(config, userConfig);
  }

  const projectConfig = loadJsoncFile(configPaths.project);
  if (projectConfig) {
    config = deepMerge(config, projectConfig);
  }

  const envConfig = loadEnvConfig(env);
  config = deepMerge(config, envConfig);

  if (
    config.routing.forceInherit !== true &&
    env.OMG_ROUTING_FORCE_INHERIT === undefined &&
    isNonGeminiProvider(env)
  ) {
    config.routing = {
      ...config.routing,
      forceInherit: true,
    };
  }

  return config;
}
