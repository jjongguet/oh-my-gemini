import { createExecTools, type ExecToolsOptions } from './exec-tools.js';
import { createFileTools, type FileToolsOptions } from './file-tools.js';
import { OmpToolRegistry } from './registry.js';
import { toGeminiToolBundle, type GeminiToolBundle } from './gemini-adapter.js';

export interface DefaultOmpToolRegistryOptions {
  cwd?: string;
  fileTools?: FileToolsOptions;
  execTools?: ExecToolsOptions;
}

export function createDefaultOmpToolRegistry(
  options: DefaultOmpToolRegistryOptions = {},
): OmpToolRegistry {
  const cwd = options.cwd ?? process.cwd();
  const registry = new OmpToolRegistry();

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
  options: DefaultOmpToolRegistryOptions = {},
): GeminiToolBundle[] {
  const registry = createDefaultOmpToolRegistry(options);
  return toGeminiToolBundle(registry.list());
}
