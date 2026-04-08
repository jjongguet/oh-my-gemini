import type { OmpToolDefinition, OmpToolJsonSchema } from './types.js';

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: OmpToolJsonSchema;
}

export interface GeminiToolBundle {
  functionDeclarations: GeminiFunctionDeclaration[];
}

function normalizeToolSchema(schema: OmpToolJsonSchema | undefined): OmpToolJsonSchema {
  return schema ?? { type: 'object', properties: {} };
}

export function toGeminiFunctionDeclaration(
  definition: OmpToolDefinition,
): GeminiFunctionDeclaration {
  return {
    name: definition.name,
    description: definition.description,
    parameters: normalizeToolSchema(definition.inputSchema),
  };
}

export function toGeminiToolBundle(
  definitions: readonly OmpToolDefinition[],
): GeminiToolBundle[] {
  return [
    {
      functionDeclarations: definitions.map((definition) =>
        toGeminiFunctionDeclaration(definition),
      ),
    },
  ];
}
