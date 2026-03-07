import { OmgMcpServer } from '../../mcp/server.js';

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
): OmgMcpServer {
  return new OmgMcpServer({
    serverInfo: {
      name: options.serverName ?? 'oh-my-gemini-cli-tools',
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
