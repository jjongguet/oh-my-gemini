export { OmgMcpClient } from './client.js';
export {
  OmgMcpServer,
  createDefaultOmgMcpServer,
  createPromptTextMessage,
  createToolTextResult,
  type DefaultOmgMcpServerOptions,
} from './server.js';
export type {
  McpJsonSchema,
  McpPromptDefinition,
  McpPromptHandlerResult,
  McpRequestContext,
  McpResourceDefinition,
  McpResourceHandlerResult,
  McpToolDefinition,
  McpToolHandlerResult,
  OmgMcpClientOptions,
  OmgMcpConnectStdioOptions,
  OmgMcpPromptDescriptor,
  OmgMcpPromptGetResult,
  OmgMcpResourceDescriptor,
  OmgMcpResourceReadResult,
  OmgMcpServerOptions,
  OmgMcpToolCallResult,
  OmgMcpToolDescriptor,
} from './types.js';
