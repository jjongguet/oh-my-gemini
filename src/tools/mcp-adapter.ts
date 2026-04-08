import type { McpToolDefinition } from '../mcp/types.js';
import type { OmpToolDefinition } from './types.js';
import { normalizeOmpToolResult } from './types.js';

export interface McpToolAdapterOptions {
  cwd?: string;
}

function toMcpToolTextResult(result: ReturnType<typeof normalizeOmpToolResult>) {
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
  definition: OmpToolDefinition,
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

      return toMcpToolTextResult(normalizeOmpToolResult(result));
    },
  };
}

export function toMcpToolDefinitions(
  definitions: readonly OmpToolDefinition[],
  options: McpToolAdapterOptions = {},
): McpToolDefinition[] {
  return definitions.map((definition) => toMcpToolDefinition(definition, options));
}
