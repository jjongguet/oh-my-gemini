import { OmpMcpServer } from '../../mcp/server.js';

import {
  createCliToolRegistry,
  type CliToolCategory,
} from './index.js';

export interface CliToolsMcpServerOptions {
  defaultCwd?: string;
  categories?: readonly CliToolCategory[];
  serverName?: string;
  serverVersion?: string;
}

export function createCliToolsMcpServer(
  options: CliToolsMcpServerOptions = {},
): OmpMcpServer {
  return new OmpMcpServer({
    serverInfo: {
      name: options.serverName ?? 'oh-my-product-cli-tools',
      version: options.serverVersion ?? '0.1.0',
    },
    tools: createCliToolRegistry({
      defaultCwd: options.defaultCwd,
      categories: options.categories,
    }),
  });
}

export async function runCliToolsMcpServer(
  options: CliToolsMcpServerOptions = {},
): Promise<void> {
  const server = createCliToolsMcpServer(options);
  await server.connectStdio();
}
