import type { OmpToolCategory, OmpToolDefinition } from './types.js';

export interface OmpToolRegistryOptions {
  tools?: readonly OmpToolDefinition[];
}

export class OmpToolRegistry {
  private readonly tools = new Map<string, OmpToolDefinition>();

  constructor(options: OmpToolRegistryOptions = {}) {
    for (const tool of options.tools ?? []) {
      this.register(tool);
    }
  }

  register(definition: OmpToolDefinition): void {
    const name = definition.name.trim();
    if (!name) {
      throw new Error('Tool name cannot be empty.');
    }

    if (this.tools.has(name)) {
      throw new Error(`Tool already registered: ${name}`);
    }

    this.tools.set(name, {
      ...definition,
      name,
    });
  }

  registerMany(definitions: readonly OmpToolDefinition[]): void {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  unregister(name: string): boolean {
    return this.tools.delete(name.trim());
  }

  has(name: string): boolean {
    return this.tools.has(name.trim());
  }

  get(name: string): OmpToolDefinition | undefined {
    return this.tools.get(name.trim());
  }

  list(): OmpToolDefinition[] {
    return [...this.tools.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  listByCategory(category: OmpToolCategory): OmpToolDefinition[] {
    return this.list().filter((tool) => tool.category === category);
  }

  listNames(): string[] {
    return this.list().map((tool) => tool.name);
  }

  toArray(): OmpToolDefinition[] {
    return this.list();
  }
}

export function createOmpToolRegistry(options: OmpToolRegistryOptions = {}): OmpToolRegistry {
  return new OmpToolRegistry(options);
}
