import type { OmgToolCategory, OmgToolDefinition } from './types.js';

export interface OmgToolRegistryOptions {
  tools?: readonly OmgToolDefinition[];
}

export class OmgToolRegistry {
  private readonly tools = new Map<string, OmgToolDefinition>();

  constructor(options: OmgToolRegistryOptions = {}) {
    for (const tool of options.tools ?? []) {
      this.register(tool);
    }
  }

  register(definition: OmgToolDefinition): void {
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

  registerMany(definitions: readonly OmgToolDefinition[]): void {
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

  get(name: string): OmgToolDefinition | undefined {
    return this.tools.get(name.trim());
  }

  list(): OmgToolDefinition[] {
    return [...this.tools.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  listByCategory(category: OmgToolCategory): OmgToolDefinition[] {
    return this.list().filter((tool) => tool.category === category);
  }

  listNames(): string[] {
    return this.list().map((tool) => tool.name);
  }

  toArray(): OmgToolDefinition[] {
    return this.list();
  }
}

export function createOmgToolRegistry(options: OmgToolRegistryOptions = {}): OmgToolRegistry {
  return new OmgToolRegistry(options);
}
