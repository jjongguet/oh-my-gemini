import { CLI_USAGE_EXIT_CODE } from '../../constants.js';
import {
  buildGeminiExtensionMcpServerConfig,
  CLI_TOOL_CATEGORIES,
  listCliToolDescriptors,
  parseCliToolCategories,
  type CliToolCategory,
  type CliToolDescriptor,
} from '../tools/index.js';
import { runCliToolsMcpServer } from '../tools/server.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

export interface ToolsCommandContext {
  io: CliIo;
  cwd: string;
  listTools?: (input: { cwd: string; categories: CliToolCategory[] }) => CliToolDescriptor[] | Promise<CliToolDescriptor[]>;
  serveTools?: (input: { cwd: string; categories: CliToolCategory[] }) => Promise<void>;
}

function printToolsHelp(io: CliIo): void {
  io.stdout([
    'Usage:',
    '  omp tools list [--json] [--categories <file,git,http,process>]',
    '  omp tools serve [--categories <file,git,http,process>]',
    '  omp tools manifest [--json] [--categories <file,git,http,process>] [--bin <command>] [--server-name <name>]',
    '',
    'Subcommands:',
    '  list      List available CLI MCP tools by category',
    '  serve     Start stdio MCP server that exposes selected tools',
    '  manifest  Print Gemini extension mcpServers registration snippet',
    '',
    `Categories: ${CLI_TOOL_CATEGORIES.join(', ')}`,
  ].join('\n'));
}

function parseCategoriesOption(options: Map<string, string | boolean>): CliToolCategory[] {
  const rawCategories = getStringOption(options, ['categories', 'category']);
  if (!rawCategories) {
    return [...CLI_TOOL_CATEGORIES];
  }

  return parseCliToolCategories(rawCategories);
}

function formatToolListText(tools: CliToolDescriptor[]): string {
  if (tools.length === 0) {
    return 'No tools available for the selected categories.';
  }

  const grouped = new Map<CliToolCategory, CliToolDescriptor[]>();
  for (const category of CLI_TOOL_CATEGORIES) {
    grouped.set(category, []);
  }

  for (const tool of tools) {
    const current = grouped.get(tool.category);
    if (current) {
      current.push(tool);
    }
  }

  const lines: string[] = [];

  for (const category of CLI_TOOL_CATEGORIES) {
    const categoryTools = grouped.get(category) ?? [];
    if (categoryTools.length === 0) {
      continue;
    }

    lines.push(`${category}:`);
    for (const tool of categoryTools) {
      lines.push(`  - ${tool.name}${tool.description ? `: ${tool.description}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

async function executeToolsList(
  argv: string[],
  context: ToolsCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printToolsHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['help', 'h', 'json', 'categories', 'category']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((value) => `--${value}`).join(', ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (parsed.positionals.length > 0) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let categories: CliToolCategory[];
  try {
    categories = parseCategoriesOption(parsed.options);
  } catch (error) {
    context.io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const listRunner = context.listTools ?? ((input: { cwd: string; categories: CliToolCategory[] }) =>
    listCliToolDescriptors({
      defaultCwd: input.cwd,
      categories: input.categories,
    }));

  const tools = await listRunner({ cwd: context.cwd, categories });

  if (hasFlag(parsed.options, ['json'])) {
    context.io.stdout(JSON.stringify({ categories, count: tools.length, tools }, null, 2));
  } else {
    context.io.stdout(formatToolListText(tools));
  }

  return { exitCode: 0 };
}

async function executeToolsServe(
  argv: string[],
  context: ToolsCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printToolsHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, ['help', 'h', 'categories', 'category']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((value) => `--${value}`).join(', ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (parsed.positionals.length > 0) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let categories: CliToolCategory[];
  try {
    categories = parseCategoriesOption(parsed.options);
  } catch (error) {
    context.io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const serveRunner = context.serveTools ?? (async (input: { cwd: string; categories: CliToolCategory[] }) => {
    await runCliToolsMcpServer({
      defaultCwd: input.cwd,
      categories: input.categories,
    });
  });

  await serveRunner({ cwd: context.cwd, categories });
  return { exitCode: 0 };
}

async function executeToolsManifest(
  argv: string[],
  context: ToolsCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printToolsHelp(context.io);
    return { exitCode: 0 };
  }

  const unknown = findUnknownOptions(parsed.options, [
    'help',
    'h',
    'json',
    'categories',
    'category',
    'bin',
    'server-name',
  ]);

  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((value) => `--${value}`).join(', ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (parsed.positionals.length > 0) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  let categories: CliToolCategory[];
  try {
    categories = parseCategoriesOption(parsed.options);
  } catch (error) {
    context.io.stderr((error as Error).message);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const binCommand = getStringOption(parsed.options, ['bin']) ?? 'oh-my-product';
  const serverName = getStringOption(parsed.options, ['server-name']);

  const registration = buildGeminiExtensionMcpServerConfig({
    binCommand,
    categories,
    serverName,
  });

  const payload = {
    mcpServers: registration,
  };

  if (hasFlag(parsed.options, ['json'])) {
    context.io.stdout(JSON.stringify(payload, null, 2));
  } else {
    context.io.stdout(JSON.stringify(payload, null, 2));
  }

  return { exitCode: 0 };
}

export async function executeToolsCommand(
  argv: string[],
  context: ToolsCommandContext,
): Promise<CommandExecutionResult> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printToolsHelp(context.io);
    return { exitCode: 0 };
  }

  const [subcommand, ...rest] = argv;

  switch (subcommand) {
    case 'list':
      return executeToolsList(rest, context);
    case 'serve':
      return executeToolsServe(rest, context);
    case 'manifest':
      return executeToolsManifest(rest, context);
    default:
      context.io.stderr(`Unknown tools subcommand: ${subcommand}`);
      printToolsHelp(context.io);
      return { exitCode: CLI_USAGE_EXIT_CODE };
  }
}
