import type { RuntimeBackend } from '../team/runtime/runtime-backend.js';

export const OMG_PLUGIN_ENABLE_ENV = 'OMG_PLUGINS';
export const OMG_NPM_PLUGINS_ENV = 'OMG_NPM_PLUGINS';
export const OMG_NPM_PLUGIN_PREFIX = 'oh-my-gemini-plugin-';

export type OmgPluginDiscoverySource =
  | 'explicit'
  | 'env'
  | 'project-config'
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies';

export interface OmgPluginContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface OmgPluginManifest {
  id?: string;
  name?: string;
  version?: string;
  runtimeBackends?: RuntimeBackend[];
  onLoad?: (context: OmgPluginContext) => void | Promise<void>;
  onUnload?: (context: OmgPluginContext) => void | Promise<void>;
  metadata?: Record<string, unknown>;
}

export interface OmgPluginModule {
  default?: OmgPluginManifest;
  plugin?: OmgPluginManifest;
}

export interface OmgNpmPluginCandidate {
  packageName: string;
  source: OmgPluginDiscoverySource;
}

export interface OmgNpmPluginPackageJson {
  name?: string;
  version?: string;
  ohMyGemini?: {
    plugin?: string;
    plugins?: string[];
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface OmgLoadedPlugin {
  id: string;
  packageName: string;
  source: OmgPluginDiscoverySource;
  modulePath: string;
  version?: string;
  manifest: OmgPluginManifest;
  runtimeBackends: RuntimeBackend[];
}

export interface OmgPluginLoadFailure {
  packageName: string;
  source: OmgPluginDiscoverySource;
  reason: string;
}

export interface OmgPluginDiscoveryOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  explicitPackages?: string[];
  includeDevDependencies?: boolean;
  includeOptionalDependencies?: boolean;
  packagePrefix?: string;
}

export interface OmgPluginLoadOptions extends OmgPluginDiscoveryOptions {
  enabled?: boolean;
  strict?: boolean;
}

export interface OmgPluginLoadResult {
  enabled: boolean;
  reason: 'ok' | 'plugins_disabled';
  candidates: OmgNpmPluginCandidate[];
  plugins: OmgLoadedPlugin[];
  failures: OmgPluginLoadFailure[];
}
