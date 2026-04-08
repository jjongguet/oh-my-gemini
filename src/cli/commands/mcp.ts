import type { CliIo, CommandExecutionResult } from '../types.js';

import { createDefaultOmpMcpServer } from '../../mcp/index.js';

import {
  findUnknownOptions,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

const CLI_USAGE_EXIT_CODE = 2;

export interface McpServeInput {
  cwd: string;
  dryRun: boolean;
}

export interface McpServeOutput {
  exitCode: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface McpServeCommandContext {
  io: CliIo;
  cwd: string;
  serveRunner?: (input: McpServeInput) => Promise<McpServeOutput>;
}

let activeMcpServer: Awaited<ReturnType<typeof createDefaultOmpMcpServer>> | null = null;
let shutdownHandlersInstalled = false;

function printMcpServeHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp mcp serve [--dry-run] [--json]',
    '',
    'Options:',
    '  --dry-run   Resolve and print MCP surfaces without opening stdio transport',
    '  --json      Print machine-readable output',
    '  --help      Show command help',
  ].join('\n'));
}

function installShutdownHandlers(): void {
  if (shutdownHandlersInstalled) {
    return;
  }

  shutdownHandlersInstalled = true;

  const shutdown = async () => {
    if (!activeMcpServer) {
      return;
    }

    const server = activeMcpServer;
    activeMcpServer = null;
    await server.close().catch(() => undefined);
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown().finally(() => {
        process.exit(0);
      });
    });
  }
}

async function defaultMcpServeRunner(input: McpServeInput): Promise<McpServeOutput> {
  const server = createDefaultOmpMcpServer({
    cwd: input.cwd,
  });

  const details = {
    cwd: input.cwd,
    toolNames: server.listTools().map((tool) => tool.name).sort(),
    resourceUris: server.listResources().map((resource) => resource.uri).sort(),
    promptNames: server.listPrompts().map((prompt) => prompt.name).sort(),
    dryRun: input.dryRun,
  };

  if (input.dryRun) {
    return {
      exitCode: 0,
      message: 'MCP surface resolved (dry-run).',
      details,
    };
  }

  await server.connectStdio();
  activeMcpServer = server;
  installShutdownHandlers();

  return {
    exitCode: 0,
    message: 'oh-my-product MCP server running on stdio transport.',
    details,
  };
}

export async function executeMcpServeCommand(
  argv: string[],
  context: McpServeCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printMcpServeHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'dry-run',
    'json',
    'help',
    'h',
  ]);

  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    printMcpServeHelp(io);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    printMcpServeHelp(io);
    return { exitCode: CLI_USAGE_EXIT_CODE };
  }

  const input: McpServeInput = {
    cwd: context.cwd,
    dryRun: hasFlag(parsed.options, ['dry-run']),
  };

  const runner = context.serveRunner ?? defaultMcpServeRunner;

  const output = await runner(input);

  if (hasFlag(parsed.options, ['json'])) {
    io.stdout(JSON.stringify(output, null, 2));
  } else {
    io.stdout(output.message);

    if (output.details) {
      io.stdout(JSON.stringify(output.details, null, 2));
    }
  }

  return {
    exitCode: output.exitCode,
  };
}
