import { GeminiSpawnBackend } from './gemini-spawn-backend.js';
import { LegacySubagentsBackend } from './subagents-backend.js';
import { TmuxRuntimeBackend } from './tmux-backend.js';
import type { RuntimeBackend, RuntimeBackendName } from './runtime-backend.js';

export class RuntimeBackendRegistry {
  private readonly backends = new Map<RuntimeBackendName, RuntimeBackend>();

  constructor(initialBackends: RuntimeBackend[] = []) {
    for (const backend of initialBackends) {
      this.register(backend);
    }
  }

  register(backend: RuntimeBackend): void {
    this.backends.set(backend.name, backend);
  }

  get(name: RuntimeBackendName): RuntimeBackend {
    const backend = this.backends.get(name);

    if (!backend) {
      throw new Error(
        `Unknown runtime backend "${name}". Available backends: ${this.list()
          .sort()
          .join(', ')}`,
      );
    }

    return backend;
  }

  list(): RuntimeBackendName[] {
    return [...this.backends.keys()];
  }
}

export function createDefaultRuntimeBackendRegistry(): RuntimeBackendRegistry {
  return new RuntimeBackendRegistry([
    new TmuxRuntimeBackend(),
    new LegacySubagentsBackend(),
    new GeminiSpawnBackend(),
  ]);
}
