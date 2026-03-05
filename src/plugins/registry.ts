import { RuntimeBackendRegistry } from '../team/runtime/backend-registry.js';
import { SubagentsRuntimeBackend } from '../team/runtime/subagents-backend.js';
import { TmuxRuntimeBackend } from '../team/runtime/tmux-backend.js';
import type { RuntimeBackend } from '../team/runtime/runtime-backend.js';
import {
  loadNpmPlugins,
} from './loader.js';
import type {
  OmgLoadedPlugin,
  OmgPluginContext,
  OmgPluginLoadOptions,
  OmgPluginLoadResult,
  OmgPluginManifest,
} from './types.js';

const CORE_BACKENDS: RuntimeBackend[] = [new TmuxRuntimeBackend(), new SubagentsRuntimeBackend()];


function assertUniqueRuntimeBackends(plugins: OmgLoadedPlugin[]): void {
  const owners = new Map<string, string>();

  for (const plugin of plugins) {
    for (const backend of plugin.runtimeBackends) {
      const owner = owners.get(backend.name);
      if (owner) {
        throw new Error(
          `Runtime backend "${backend.name}" is provided by multiple plugins: ${owner}, ${plugin.id}`,
        );
      }

      owners.set(backend.name, plugin.id);
    }
  }
}

function assertUniquePluginIds(plugins: OmgLoadedPlugin[]): void {
  const ids = new Set<string>();
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) {
      throw new Error(`Duplicate plugin id detected: ${plugin.id}`);
    }
    ids.add(plugin.id);
  }
}

export class PluginRegistry {
  private readonly pluginById = new Map<string, OmgLoadedPlugin>();

  constructor(
    plugins: OmgLoadedPlugin[],
    private readonly context: OmgPluginContext,
  ) {
    assertUniquePluginIds(plugins);
    assertUniqueRuntimeBackends(plugins);

    for (const plugin of plugins) {
      this.pluginById.set(plugin.id, plugin);
    }
  }

  list(): OmgLoadedPlugin[] {
    return [...this.pluginById.values()];
  }

  get(pluginId: string): OmgLoadedPlugin {
    const plugin = this.pluginById.get(pluginId);
    if (!plugin) {
      throw new Error(
        `Unknown plugin "${pluginId}". Loaded plugins: ${this.list()
          .map((entry) => entry.id)
          .sort()
          .join(', ')}`,
      );
    }

    return plugin;
  }

  async invokeLoadHooks(): Promise<void> {
    for (const plugin of this.list()) {
      if (typeof plugin.manifest.onLoad === 'function') {
        await plugin.manifest.onLoad(this.context);
      }
    }
  }

  async invokeUnloadHooks(): Promise<void> {
    for (const plugin of this.list()) {
      if (typeof plugin.manifest.onUnload === 'function') {
        await plugin.manifest.onUnload(this.context);
      }
    }
  }

  createRuntimeBackendRegistry(initialBackends: RuntimeBackend[] = CORE_BACKENDS): RuntimeBackendRegistry {
    const registry = new RuntimeBackendRegistry(initialBackends);

    for (const plugin of this.list()) {
      for (const backend of plugin.runtimeBackends) {
        registry.register(backend);
      }
    }

    return registry;
  }
}

export interface LoadedPluginRegistry {
  registry: PluginRegistry;
  load: OmgPluginLoadResult;
}

export async function loadPluginRegistry(
  options: OmgPluginLoadOptions,
): Promise<LoadedPluginRegistry> {
  const env = options.env ?? process.env;
  const load = await loadNpmPlugins(options);

  const registry = new PluginRegistry(load.plugins, {
    cwd: options.cwd,
    env,
  });

  await registry.invokeLoadHooks();

  return {
    registry,
    load,
  };
}

export function createRuntimeBackendRegistryFromPlugins(
  plugins: OmgLoadedPlugin[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeBackendRegistry {
  const registry = new PluginRegistry(plugins, { cwd, env });
  return registry.createRuntimeBackendRegistry();
}

export type { OmgPluginManifest };
