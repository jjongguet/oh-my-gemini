import type { McpJsonSchema, McpToolDefinition } from '../../mcp/types.js';

export const CLI_TOOL_CATEGORIES = ['file', 'git', 'http', 'process'] as const;

export type CliToolCategory = (typeof CLI_TOOL_CATEGORIES)[number];

export interface CliToolDefinition extends McpToolDefinition {
  category: CliToolCategory;
}

export interface CliToolDescriptor {
  name: string;
  description?: string;
  category: CliToolCategory;
  inputSchema: McpJsonSchema;
}
