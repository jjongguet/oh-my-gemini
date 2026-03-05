import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type GetPromptResult,
  type Implementation,
  type PromptMessage,
  type ReadResourceResult,
  type ServerNotification,
  type ServerRequest,
  type TextContent,
} from '@modelcontextprotocol/sdk/types.js';

import type {
  McpJsonSchema,
  McpPromptDefinition,
  McpPromptHandlerResult,
  McpRequestContext,
  McpResourceDefinition,
  McpResourceHandlerResult,
  McpToolDefinition,
  McpToolHandlerResult,
  OmgMcpPromptDescriptor,
  OmgMcpResourceDescriptor,
  OmgMcpServerOptions,
  OmgMcpToolCallResult,
  OmgMcpToolDescriptor,
} from './types.js';

const DEFAULT_SERVER_INFO: Implementation = {
  name: 'oh-my-gemini-mcp',
  version: '0.1.0',
};

const EMPTY_OBJECT_SCHEMA: McpJsonSchema = {
  type: 'object',
  properties: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRequestContext(
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
): McpRequestContext {
  return {
    signal: extra.signal,
    requestId: extra.requestId,
    sessionId: extra.sessionId,
  };
}

function textContent(text: string): TextContent {
  return {
    type: 'text',
    text,
  };
}

function normalizeToolResult(result: McpToolHandlerResult): OmgMcpToolCallResult {
  if (typeof result === 'string') {
    return {
      content: [textContent(result)],
    };
  }

  return result;
}

function createToolErrorResult(error: unknown): OmgMcpToolCallResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [textContent(message)],
    isError: true,
  };
}

function isInlineTextResourcePayload(
  value: unknown,
): value is { text: string; mimeType?: string } {
  return isRecord(value) && typeof value.text === 'string';
}

function normalizeResourceResult(
  uri: string,
  result: McpResourceHandlerResult,
): ReadResourceResult {
  if (typeof result === 'string') {
    return {
      contents: [{ uri, text: result }],
    };
  }

  if (isInlineTextResourcePayload(result)) {
    return {
      contents: [
        {
          uri,
          text: result.text,
          mimeType: result.mimeType,
        },
      ],
    };
  }

  return result;
}

function normalizePromptResult(result: McpPromptHandlerResult): GetPromptResult {
  if (typeof result === 'string') {
    return {
      messages: [
        {
          role: 'user',
          content: textContent(result),
        },
      ],
    };
  }

  if (Array.isArray(result)) {
    return {
      messages: result,
    };
  }

  return result;
}

export class OmgMcpServer {
  private readonly tools = new Map<string, McpToolDefinition>();
  private readonly resources = new Map<string, McpResourceDefinition>();
  private readonly prompts = new Map<string, McpPromptDefinition>();
  private readonly server: Server;
  private connected = false;

  constructor(options: OmgMcpServerOptions = {}) {
    this.server = new Server(options.serverInfo ?? DEFAULT_SERVER_INFO, {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
    });

    this.registerRequestHandlers();

    for (const tool of options.tools ?? []) {
      this.registerTool(tool);
    }

    for (const resource of options.resources ?? []) {
      this.registerResource(resource);
    }

    for (const prompt of options.prompts ?? []) {
      this.registerPrompt(prompt);
    }
  }

  get rawServer(): Server {
    return this.server;
  }

  listTools(): OmgMcpToolDescriptor[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema ?? EMPTY_OBJECT_SCHEMA,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    }));
  }

  listResources(): OmgMcpResourceDescriptor[] {
    return [...this.resources.values()].map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      title: resource.title,
      description: resource.description,
      mimeType: resource.mimeType,
      annotations: resource.annotations,
    }));
  }

  listPrompts(): OmgMcpPromptDescriptor[] {
    return [...this.prompts.values()].map((prompt) => ({
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  }

  registerTool(definition: McpToolDefinition): void {
    const name = definition.name.trim();
    if (!name) {
      throw new Error('MCP tool name cannot be empty.');
    }
    if (this.tools.has(name)) {
      throw new Error(`MCP tool already registered: ${name}`);
    }

    this.tools.set(name, {
      ...definition,
      name,
    });
    this.notifyToolListChanged();
  }

  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name.trim());
    if (removed) {
      this.notifyToolListChanged();
    }
    return removed;
  }

  registerResource(definition: McpResourceDefinition): void {
    const uri = definition.uri.trim();
    if (!uri) {
      throw new Error('MCP resource URI cannot be empty.');
    }
    if (this.resources.has(uri)) {
      throw new Error(`MCP resource already registered: ${uri}`);
    }

    this.resources.set(uri, {
      ...definition,
      uri,
    });
    this.notifyResourceListChanged();
  }

  unregisterResource(uri: string): boolean {
    const removed = this.resources.delete(uri.trim());
    if (removed) {
      this.notifyResourceListChanged();
    }
    return removed;
  }

  registerPrompt(definition: McpPromptDefinition): void {
    const name = definition.name.trim();
    if (!name) {
      throw new Error('MCP prompt name cannot be empty.');
    }
    if (this.prompts.has(name)) {
      throw new Error(`MCP prompt already registered: ${name}`);
    }

    this.prompts.set(name, {
      ...definition,
      name,
    });
    this.notifyPromptListChanged();
  }

  unregisterPrompt(name: string): boolean {
    const removed = this.prompts.delete(name.trim());
    if (removed) {
      this.notifyPromptListChanged();
    }
    return removed;
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
    this.connected = true;
  }

  async connectStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
    this.connected = false;
  }

  private registerRequestHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.listTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const tool = this.tools.get(request.params.name);
      if (!tool) {
        return createToolErrorResult(`Unknown tool: ${request.params.name}`);
      }

      const args = isRecord(request.params.arguments)
        ? request.params.arguments
        : {};

      try {
        const result = await tool.handler(args, toRequestContext(extra));
        return normalizeToolResult(result);
      } catch (error) {
        return createToolErrorResult(error);
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.listResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      const resource = this.resources.get(request.params.uri);
      if (!resource) {
        throw new Error(`Unknown resource URI: ${request.params.uri}`);
      }

      const result = await resource.handler({
        ...toRequestContext(extra),
        uri: request.params.uri,
      });

      return normalizeResourceResult(request.params.uri, result);
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.listPrompts(),
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
      const prompt = this.prompts.get(request.params.name);
      if (!prompt) {
        throw new Error(`Unknown prompt: ${request.params.name}`);
      }

      const argumentsRecord: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.params.arguments ?? {})) {
        if (typeof value === 'string') {
          argumentsRecord[key] = value;
        }
      }

      const result = await prompt.handler(argumentsRecord, toRequestContext(extra));
      return normalizePromptResult(result);
    });
  }

  private notifyToolListChanged(): void {
    if (!this.connected) {
      return;
    }

    void this.server.sendToolListChanged().catch(() => undefined);
  }

  private notifyResourceListChanged(): void {
    if (!this.connected) {
      return;
    }

    void this.server.sendResourceListChanged().catch(() => undefined);
  }

  private notifyPromptListChanged(): void {
    if (!this.connected) {
      return;
    }

    void this.server.sendPromptListChanged().catch(() => undefined);
  }
}

export function createPromptTextMessage(text: string): PromptMessage {
  return {
    role: 'user',
    content: textContent(text),
  };
}

export function createToolTextResult(
  text: string,
  options: { isError?: boolean } = {},
): OmgMcpToolCallResult {
  return {
    content: [textContent(text)],
    isError: options.isError,
  };
}
