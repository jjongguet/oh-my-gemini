import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { RuntimeBackend } from '../team/runtime/runtime-backend.js';
import {
  OMG_NPM_PLUGIN_PREFIX,
  OMG_NPM_PLUGINS_ENV,
  OMG_PLUGIN_ENABLE_ENV,
  type OmgLoadedPlugin,
  type OmgNpmPluginCandidate,
  type OmgNpmPluginPackageJson,
  type OmgPluginDiscoveryOptions,
  type OmgPluginDiscoverySource,
  type OmgPluginLoadFailure,
  type OmgPluginLoadOptions,
  type OmgPluginLoadResult,
  type OmgPluginManifest,
  type OmgPluginModule,
} from './types.js';

function parseBooleanFlag(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePluginList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizePluginId(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'plugin';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeBackend(value: unknown): value is RuntimeBackend {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === 'string' &&
    typeof value.probePrerequisites === 'function' &&
    typeof value.startTeam === 'function' &&
    typeof value.monitorTeam === 'function' &&
    typeof value.shutdownTeam === 'function'
  );
}

function createRequireFromCwd(cwd: string): NodeRequire {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    return createRequire(packageJsonPath);
  }

  return createRequire(path.join(cwd, '__omg_plugin_loader__.js'));
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readDependencyNames(record: Record<string, string> | undefined): string[] {
  if (!record) {
    return [];
  }

  return Object.keys(record).sort((a, b) => a.localeCompare(b));
}

function isNpmPluginPackageName(packageName: string, packagePrefix: string): boolean {
  if (packageName.startsWith(packagePrefix)) {
    return true;
  }

  const slashIndex = packageName.indexOf('/');
  if (!packageName.startsWith('@') || slashIndex === -1) {
    return false;
  }

  const unscopedName = packageName.slice(slashIndex + 1);
  return unscopedName.startsWith(packagePrefix);
}

function pushCandidates(
  target: OmgNpmPluginCandidate[],
  seen: Set<string>,
  names: string[],
  source: OmgPluginDiscoverySource,
): void {
  for (const name of names) {
    if (seen.has(name)) {
      continue;
    }

    seen.add(name);
    target.push({ packageName: name, source });
  }
}

export function isPluginSystemEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBooleanFlag(env[OMG_PLUGIN_ENABLE_ENV]);
}

export async function discoverNpmPluginCandidates(
  options: OmgPluginDiscoveryOptions,
): Promise<OmgNpmPluginCandidate[]> {
  const env = options.env ?? process.env;
  const packagePrefix = options.packagePrefix ?? OMG_NPM_PLUGIN_PREFIX;
  const includeDevDependencies = options.includeDevDependencies ?? true;
  const includeOptionalDependencies = options.includeOptionalDependencies ?? true;

  const candidates: OmgNpmPluginCandidate[] = [];
  const seen = new Set<string>();

  pushCandidates(candidates, seen, options.explicitPackages ?? [], 'explicit');
  pushCandidates(candidates, seen, parsePluginList(env[OMG_NPM_PLUGINS_ENV]), 'env');

  const projectPackageJsonPath = path.join(options.cwd, 'package.json');
  const projectPackage = await readJsonFile<OmgNpmPluginPackageJson>(projectPackageJsonPath);

  if (projectPackage) {
    pushCandidates(
      candidates,
      seen,
      (projectPackage.ohMyGemini?.plugins ?? []).map((item) => item.trim()).filter(Boolean),
      'project-config',
    );

    pushCandidates(
      candidates,
      seen,
      readDependencyNames(projectPackage.dependencies).filter((name) =>
        isNpmPluginPackageName(name, packagePrefix),
      ),
      'dependencies',
    );

    if (includeDevDependencies) {
      pushCandidates(
        candidates,
        seen,
        readDependencyNames(projectPackage.devDependencies).filter((name) =>
          isNpmPluginPackageName(name, packagePrefix),
        ),
        'devDependencies',
      );
    }

    if (includeOptionalDependencies) {
      pushCandidates(
        candidates,
        seen,
        readDependencyNames(projectPackage.optionalDependencies).filter((name) =>
          isNpmPluginPackageName(name, packagePrefix),
        ),
        'optionalDependencies',
      );
    }
  }

  return candidates;
}

function extractPluginExport(moduleNamespace: OmgPluginModule): OmgPluginManifest {
  const exported = moduleNamespace.default ?? moduleNamespace.plugin;

  if (!isRecord(exported)) {
    throw new Error('plugin module must export default or named "plugin" object');
  }

  return exported as OmgPluginManifest;
}

function resolveRuntimeBackends(manifest: OmgPluginManifest): RuntimeBackend[] {
  const backends = manifest.runtimeBackends ?? [];
  const resolved: RuntimeBackend[] = [];
  const names = new Set<string>();

  for (const backend of backends) {
    if (!isRuntimeBackend(backend)) {
      throw new Error('runtimeBackends entries must implement RuntimeBackend contract');
    }

    if (names.has(backend.name)) {
      throw new Error(`duplicate runtime backend name: ${backend.name}`);
    }

    names.add(backend.name);
    resolved.push(backend);
  }

  return resolved;
}

async function resolvePluginPackageJson(
  requireFromCwd: NodeRequire,
  packageName: string,
): Promise<{ manifest: OmgNpmPluginPackageJson | null; manifestPath?: string }> {
  let manifestPath: string | undefined;
  try {
    manifestPath = requireFromCwd.resolve(`${packageName}/package.json`);
  } catch {
    return { manifest: null };
  }

  const manifest = await readJsonFile<OmgNpmPluginPackageJson>(manifestPath);
  return { manifest, manifestPath };
}

function resolvePluginModulePath(
  requireFromCwd: NodeRequire,
  packageName: string,
  manifest: OmgNpmPluginPackageJson | null,
  manifestPath?: string,
): string {
  const configuredEntry = manifest?.ohMyGemini?.plugin;
  if (typeof configuredEntry === 'string' && configuredEntry.trim() !== '') {
    const packageDir = manifestPath ? path.dirname(manifestPath) : undefined;
    if (!packageDir) {
      throw new Error('plugin package declared ohMyGemini.plugin but package root is unknown');
    }

    return path.resolve(packageDir, configuredEntry);
  }

  return requireFromCwd.resolve(packageName);
}

export async function loadNpmPlugin(
  candidate: OmgNpmPluginCandidate,
  cwd: string,
): Promise<OmgLoadedPlugin> {
  const requireFromCwd = createRequireFromCwd(cwd);

  const { manifest: packageManifest, manifestPath } = await resolvePluginPackageJson(
    requireFromCwd,
    candidate.packageName,
  );

  const modulePath = resolvePluginModulePath(
    requireFromCwd,
    candidate.packageName,
    packageManifest,
    manifestPath,
  );

  const moduleUrl = pathToFileURL(modulePath).href;
  const moduleNamespace = (await import(moduleUrl)) as OmgPluginModule;
  const exportedManifest = extractPluginExport(moduleNamespace);

  const pluginId = normalizePluginId(exportedManifest.id ?? candidate.packageName);
  const runtimeBackends = resolveRuntimeBackends(exportedManifest);
  const version = exportedManifest.version ?? packageManifest?.version;

  const normalizedManifest: OmgPluginManifest = {
    ...exportedManifest,
    id: pluginId,
    name: exportedManifest.name ?? pluginId,
    version,
    runtimeBackends,
  };

  return {
    id: pluginId,
    packageName: candidate.packageName,
    source: candidate.source,
    modulePath,
    version,
    manifest: normalizedManifest,
    runtimeBackends,
  };
}

function buildFailure(candidate: OmgNpmPluginCandidate, error: unknown): OmgPluginLoadFailure {
  return {
    packageName: candidate.packageName,
    source: candidate.source,
    reason: error instanceof Error ? error.message : 'unknown_plugin_load_error',
  };
}

export async function loadNpmPlugins(
  options: OmgPluginLoadOptions,
): Promise<OmgPluginLoadResult> {
  const env = options.env ?? process.env;
  const enabled = options.enabled ?? isPluginSystemEnabled(env);

  if (!enabled) {
    return {
      enabled: false,
      reason: 'plugins_disabled',
      candidates: [],
      plugins: [],
      failures: [],
    };
  }

  const candidates = await discoverNpmPluginCandidates({
    cwd: options.cwd,
    env,
    explicitPackages: options.explicitPackages,
    includeDevDependencies: options.includeDevDependencies,
    includeOptionalDependencies: options.includeOptionalDependencies,
    packagePrefix: options.packagePrefix,
  });

  const plugins: OmgLoadedPlugin[] = [];
  const failures: OmgPluginLoadFailure[] = [];

  for (const candidate of candidates) {
    try {
      const plugin = await loadNpmPlugin(candidate, options.cwd);
      plugins.push(plugin);
    } catch (error) {
      if (options.strict) {
        throw error;
      }

      failures.push(buildFailure(candidate, error));
    }
  }

  return {
    enabled: true,
    reason: 'ok',
    candidates,
    plugins,
    failures,
  };
}
