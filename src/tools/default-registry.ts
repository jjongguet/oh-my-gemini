import { createExecTools, type ExecToolsOptions } from './exec-tools.js';
import { createFileTools, type FileToolsOptions } from './file-tools.js';
import { OmgToolRegistry } from './registry.js';
import { toGeminiToolBundle, type GeminiToolBundle } from './gemini-adapter.js';

export interface DefaultOmgToolRegistryOptions {
  cwd?: string;
  fileTools?: FileToolsOptions;
  execTools?: ExecToolsOptions;
}

export function createDefaultOmgToolRegistry(
  options: DefaultOmgToolRegistryOptions = {},
): OmgToolRegistry {
  const cwd = options.cwd ?? process.cwd();
  const registry = new OmgToolRegistry();

  registry.registerMany(
    createFileTools({
      rootDir: options.fileTools?.rootDir ?? cwd,
      listLimit: options.fileTools?.listLimit,
      readMaxBytes: options.fileTools?.readMaxBytes,
    }),
  );

  registry.registerMany(createExecTools(options.execTools));

  return registry;
}

export function createDefaultGeminiTools(
  options: DefaultOmgToolRegistryOptions = {},
): GeminiToolBundle[] {
  const registry = createDefaultOmgToolRegistry(options);
  return toGeminiToolBundle(registry.list());
}
