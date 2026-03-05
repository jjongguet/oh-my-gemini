import { createFileTools } from './file-tools.js';
import { createGitTools } from './git-tools.js';
import { createHttpTools } from './http-tools.js';
import { createProcessTools } from './process-tools.js';
import { CLI_TOOL_CATEGORIES, type CliToolCategory, type CliToolDefinition, type CliToolDescriptor } from './types.js';

export interface CliToolRegistryOptions {
  defaultCwd?: string;
  categories?: readonly CliToolCategory[];
}

export interface GeminiExtensionMcpServerConfig {
  command: string;
  args: string[];
  transport: 'stdio';
  description: string;
}

export const GEMINI_EXTENSION_CLI_TOOLS_SERVER_NAME = 'omg_cli_tools';

function normalizeCategoryInput(values?: readonly CliToolCategory[]): CliToolCategory[] {
  if (!values || values.length === 0) {
    return [...CLI_TOOL_CATEGORIES];
  }

  const unique = new Set<CliToolCategory>();
  for (const value of values) {
    unique.add(value);
  }

  return [...unique];
}

export function isCliToolCategory(value: string): value is CliToolCategory {
  return CLI_TOOL_CATEGORIES.includes(value as CliToolCategory);
}

export function parseCliToolCategories(input: string): CliToolCategory[] {
  const values = input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return [...CLI_TOOL_CATEGORIES];
  }

  const categories: CliToolCategory[] = [];
  for (const value of values) {
    if (!isCliToolCategory(value)) {
      throw new Error(`Unknown tool category: ${value}`);
    }
    if (!categories.includes(value)) {
      categories.push(value);
    }
  }

  return categories;
}

export function createCliToolRegistry(options: CliToolRegistryOptions = {}): CliToolDefinition[] {
  const categories = normalizeCategoryInput(options.categories);
  const include = new Set(categories);
  const tools: CliToolDefinition[] = [];

  if (include.has('file')) {
    tools.push(...createFileTools({ defaultCwd: options.defaultCwd }));
  }

  if (include.has('git')) {
    tools.push(...createGitTools({ defaultCwd: options.defaultCwd }));
  }

  if (include.has('http')) {
    tools.push(...createHttpTools());
  }

  if (include.has('process')) {
    tools.push(...createProcessTools({ defaultCwd: options.defaultCwd }));
  }

  return tools;
}

export function listCliToolDescriptors(options: CliToolRegistryOptions = {}): CliToolDescriptor[] {
  return createCliToolRegistry(options).map((tool) => ({
    name: tool.name,
    description: tool.description,
    category: tool.category,
    inputSchema: tool.inputSchema ?? {
      type: 'object',
      properties: {},
    },
  }));
}

export function buildGeminiExtensionMcpServerConfig(options: {
  binCommand?: string;
  categories?: readonly CliToolCategory[];
  serverName?: string;
} = {}): Record<string, GeminiExtensionMcpServerConfig> {
  const binCommand = options.binCommand ?? 'oh-my-gemini';
  const serverName = options.serverName ?? GEMINI_EXTENSION_CLI_TOOLS_SERVER_NAME;
  const categories = normalizeCategoryInput(options.categories);

  const args = ['tools', 'serve'];
  if (categories.length > 0 && categories.length < CLI_TOOL_CATEGORIES.length) {
    args.push('--categories', categories.join(','));
  }

  return {
    [serverName]: {
      command: binCommand,
      args,
      transport: 'stdio',
      description: 'oh-my-gemini CLI tools MCP server (file/git/http/process)',
    },
  };
}

export {
  CLI_TOOL_CATEGORIES,
  type CliToolCategory,
  type CliToolDefinition,
  type CliToolDescriptor,
};
