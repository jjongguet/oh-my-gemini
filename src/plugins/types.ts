import type { RuntimeBackend } from '../team/runtime/runtime-backend.js';

export const OMP_PLUGIN_ENABLE_ENV = 'OMP_PLUGINS';
export const OMP_NPM_PLUGINS_ENV = 'OMP_NPM_PLUGINS';
export const OMP_NPM_PLUGIN_PREFIX = 'oh-my-product-plugin-';

export type OmpPluginDiscoverySource =
  | 'explicit'
  | 'env'
  | 'project-config'
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies';

export interface OmpPluginContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface OmpPluginManifest {
  id?: string;
  name?: string;
  version?: string;
  runtimeBackends?: RuntimeBackend[];
  onLoad?: (context: OmpPluginContext) => void | Promise<void>;
  onUnload?: (context: OmpPluginContext) => void | Promise<void>;
  metadata?: Record<string, unknown>;
}

export interface OmpPluginModule {
  default?: OmpPluginManifest;
  plugin?: OmpPluginManifest;
}

export interface OmpNpmPluginCandidate {
  packageName: string;
  source: OmpPluginDiscoverySource;
}

export interface OmpNpmPluginPackageJson {
  name?: string;
  version?: string;
  ohMyProduct?: {
    plugin?: string;
    plugins?: string[];
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface OmpLoadedPlugin {
  id: string;
  packageName: string;
  source: OmpPluginDiscoverySource;
  modulePath: string;
  version?: string;
  manifest: OmpPluginManifest;
  runtimeBackends: RuntimeBackend[];
}

export interface OmpPluginLoadFailure {
  packageName: string;
  source: OmpPluginDiscoverySource;
  reason: string;
}

export interface OmpPluginDiscoveryOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  explicitPackages?: string[];
  includeDevDependencies?: boolean;
  includeOptionalDependencies?: boolean;
  packagePrefix?: string;
}

export interface OmpPluginLoadOptions extends OmpPluginDiscoveryOptions {
  enabled?: boolean;
  strict?: boolean;
}

export interface OmpPluginLoadResult {
  enabled: boolean;
  reason: 'ok' | 'plugins_disabled';
  candidates: OmpNpmPluginCandidate[];
  plugins: OmpLoadedPlugin[];
  failures: OmpPluginLoadFailure[];
}
