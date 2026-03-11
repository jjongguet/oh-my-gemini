import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  type StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, type Implementation } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type {
  OmgMcpClientOptions,
  OmgMcpPromptDescriptor,
  OmgMcpPromptGetResult,
  OmgMcpResourceDescriptor,
  OmgMcpResourceReadResult,
  OmgMcpToolCallResult,
  OmgMcpToolDescriptor,
} from './types.js';

const DEFAULT_CLIENT_INFO: Implementation = {
  name: 'oh-my-gemini-mcp-client',
  version: '0.5.0',
};

export class OmgMcpClient {
  private readonly client: Client;
  private connected = false;

  constructor(options: OmgMcpClientOptions = {}) {
    this.client = new Client(options.clientInfo ?? DEFAULT_CLIENT_INFO);
  }

  get rawClient(): Client {
    return this.client;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(transport: Transport): Promise<void> {
    await this.client.connect(transport);
    this.connected = true;
  }

  async connectStdio(server: StdioServerParameters): Promise<void> {
    const transport = new StdioClientTransport(server);
    await this.connect(transport);
  }

  async close(): Promise<void> {
    await this.client.close();
    this.connected = false;
  }

  async listTools(): Promise<OmgMcpToolDescriptor[]> {
    const tools: OmgMcpToolDescriptor[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.listTools(
        cursor ? { cursor } : undefined,
      );

      tools.push(...result.tools);
      cursor = result.nextCursor;
    } while (cursor);

    return tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<OmgMcpToolCallResult> {
    const result = await this.client.callTool(
      {
        name,
        arguments: args,
      },
      CallToolResultSchema,
    );

    return result as OmgMcpToolCallResult;
  }

  async listResources(): Promise<OmgMcpResourceDescriptor[]> {
    const resources: OmgMcpResourceDescriptor[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.listResources(
        cursor ? { cursor } : undefined,
      );

      resources.push(...result.resources);
      cursor = result.nextCursor;
    } while (cursor);

    return resources;
  }

  async readResource(uri: string): Promise<OmgMcpResourceReadResult> {
    return this.client.readResource({ uri });
  }

  async listPrompts(): Promise<OmgMcpPromptDescriptor[]> {
    const prompts: OmgMcpPromptDescriptor[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.listPrompts(
        cursor ? { cursor } : undefined,
      );

      prompts.push(...result.prompts);
      cursor = result.nextCursor;
    } while (cursor);

    return prompts;
  }

  async getPrompt(
    name: string,
    argumentsMap?: Record<string, string>,
  ): Promise<OmgMcpPromptGetResult> {
    return this.client.getPrompt({
      name,
      arguments: argumentsMap,
    });
  }
}
