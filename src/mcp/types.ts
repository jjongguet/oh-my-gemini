import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  CallToolResult,
  GetPromptResult,
  Implementation,
  Prompt,
  PromptArgument,
  PromptMessage,
  ReadResourceResult,
  Resource,
  Tool,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';

export interface McpJsonSchema {
  type: 'object';
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
}

export interface McpRequestContext {
  signal: AbortSignal;
  requestId: string | number;
  sessionId?: string;
}

export type McpToolHandlerResult = CallToolResult | string;

export interface McpToolDefinition {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: McpJsonSchema;
  outputSchema?: McpJsonSchema;
  annotations?: ToolAnnotations;
  handler: (
    args: Record<string, unknown>,
    context: McpRequestContext,
  ) => Promise<McpToolHandlerResult> | McpToolHandlerResult;
}

export type McpResourceHandlerResult =
  | ReadResourceResult
  | string
  | {
      text: string;
      mimeType?: string;
    };

export interface McpResourceDefinition {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Resource['annotations'];
  handler: (
    context: McpRequestContext & { uri: string },
  ) => Promise<McpResourceHandlerResult> | McpResourceHandlerResult;
}

export type McpPromptHandlerResult = GetPromptResult | PromptMessage[] | string;

export interface McpPromptDefinition {
  name: string;
  title?: string;
  description?: string;
  arguments?: PromptArgument[];
  handler: (
    args: Record<string, string>,
    context: McpRequestContext,
  ) => Promise<McpPromptHandlerResult> | McpPromptHandlerResult;
}

export interface OmgMcpServerOptions {
  serverInfo?: Implementation;
  tools?: readonly McpToolDefinition[];
  resources?: readonly McpResourceDefinition[];
  prompts?: readonly McpPromptDefinition[];
}

export interface OmgMcpClientOptions {
  clientInfo?: Implementation;
}

export interface OmgMcpConnectStdioOptions {
  server: StdioServerParameters;
}

export type OmgMcpToolDescriptor = Tool;
export type OmgMcpResourceDescriptor = Resource;
export type OmgMcpPromptDescriptor = Prompt;
export type OmgMcpToolCallResult = CallToolResult;
export type OmgMcpResourceReadResult = ReadResourceResult;
export type OmgMcpPromptGetResult = GetPromptResult;
