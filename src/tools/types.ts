export interface OmpToolJsonSchema {
  type: 'object';
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
}

export interface OmpToolRequestContext {
  signal: AbortSignal;
  requestId: string | number;
  sessionId?: string;
  cwd: string;
}

export interface OmpToolTextResult {
  text: string;
  isError?: boolean;
}

export type OmpToolHandlerResult = OmpToolTextResult | string;

export type OmpToolCategory =
  | 'file'
  | 'exec'
  | 'team'
  | 'mailbox'
  | 'system'
  | 'custom';

export interface OmpToolDefinition {
  name: string;
  description: string;
  category?: OmpToolCategory;
  inputSchema?: OmpToolJsonSchema;
  handler: (
    args: Record<string, unknown>,
    context: OmpToolRequestContext,
  ) => Promise<OmpToolHandlerResult> | OmpToolHandlerResult;
}

export function isOmpToolTextResult(value: unknown): value is OmpToolTextResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<OmpToolTextResult>;
  return typeof candidate.text === 'string';
}

export function normalizeOmpToolResult(result: OmpToolHandlerResult): OmpToolTextResult {
  if (typeof result === 'string') {
    return { text: result };
  }

  if (isOmpToolTextResult(result)) {
    return result;
  }

  return {
    text: String(result),
    isError: true,
  };
}
