import type { McpToolDefinition } from '../mcp/types.js';
import type { OmgToolDefinition } from './types.js';
import { normalizeOmgToolResult } from './types.js';

export interface McpToolAdapterOptions {
  cwd?: string;
}

function toMcpToolTextResult(result: ReturnType<typeof normalizeOmgToolResult>) {
  return {
    content: [
      {
        type: 'text' as const,
        text: result.text,
      },
    ],
    isError: result.isError,
  };
}

export function toMcpToolDefinition(
  definition: OmgToolDefinition,
  options: McpToolAdapterOptions = {},
): McpToolDefinition {
  const cwd = options.cwd ?? process.cwd();

  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    async handler(args, context) {
      const result = await definition.handler(args, {
        ...context,
        cwd,
      });

      if (typeof result === 'string') {
        return result;
      }

      return toMcpToolTextResult(normalizeOmgToolResult(result));
    },
  };
}

export function toMcpToolDefinitions(
  definitions: readonly OmgToolDefinition[],
  options: McpToolAdapterOptions = {},
): McpToolDefinition[] {
  return definitions.map((definition) => toMcpToolDefinition(definition, options));
}
