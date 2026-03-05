export interface OmgToolJsonSchema {
  type: 'object';
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
}

export interface OmgToolRequestContext {
  signal: AbortSignal;
  requestId: string | number;
  sessionId?: string;
  cwd: string;
}

export interface OmgToolTextResult {
  text: string;
  isError?: boolean;
}

export type OmgToolHandlerResult = OmgToolTextResult | string;

export type OmgToolCategory =
  | 'file'
  | 'exec'
  | 'team'
  | 'mailbox'
  | 'system'
  | 'custom';

export interface OmgToolDefinition {
  name: string;
  description: string;
  category?: OmgToolCategory;
  inputSchema?: OmgToolJsonSchema;
  handler: (
    args: Record<string, unknown>,
    context: OmgToolRequestContext,
  ) => Promise<OmgToolHandlerResult> | OmgToolHandlerResult;
}

export function isOmgToolTextResult(value: unknown): value is OmgToolTextResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<OmgToolTextResult>;
  return typeof candidate.text === 'string';
}

export function normalizeOmgToolResult(result: OmgToolHandlerResult): OmgToolTextResult {
  if (typeof result === 'string') {
    return { text: result };
  }

  if (isOmgToolTextResult(result)) {
    return result;
  }

  return {
    text: String(result),
    isError: true,
  };
}
