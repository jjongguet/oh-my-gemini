import type { OmgToolDefinition, OmgToolJsonSchema } from './types.js';

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: OmgToolJsonSchema;
}

export interface GeminiToolBundle {
  functionDeclarations: GeminiFunctionDeclaration[];
}

function normalizeToolSchema(schema: OmgToolJsonSchema | undefined): OmgToolJsonSchema {
  return schema ?? { type: 'object', properties: {} };
}

export function toGeminiFunctionDeclaration(
  definition: OmgToolDefinition,
): GeminiFunctionDeclaration {
  return {
    name: definition.name,
    description: definition.description,
    parameters: normalizeToolSchema(definition.inputSchema),
  };
}

export function toGeminiToolBundle(
  definitions: readonly OmgToolDefinition[],
): GeminiToolBundle[] {
  return [
    {
      functionDeclarations: definitions.map((definition) =>
        toGeminiFunctionDeclaration(definition),
      ),
    },
  ];
}
