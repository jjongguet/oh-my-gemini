export type RecoveryKind =
  | 'context_limit'
  | 'permission'
  | 'transient'
  | 'tool_error'
  | 'fatal';

export interface RecoveryDecision {
  recoverable: boolean;
  shouldRetry: boolean;
  retryDelayMs: number;
  kind: RecoveryKind;
  message: string;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function detectRecoverableError(error: unknown): RecoveryDecision {
  const message = readMessage(error).toLowerCase();

  if (message.includes('context') && (message.includes('limit') || message.includes('window'))) {
    return {
      recoverable: true,
      shouldRetry: true,
      retryDelayMs: 250,
      kind: 'context_limit',
      message: 'Context-window pressure detected; compact and retry.',
    };
  }

  if (message.includes('permission') || message.includes('eacces') || message.includes('denied')) {
    return {
      recoverable: true,
      shouldRetry: false,
      retryDelayMs: 0,
      kind: 'permission',
      message: 'Permission failure detected; request elevated access or adjust the command.',
    };
  }

  if (message.includes('timeout') || message.includes('temporar') || message.includes('network')) {
    return {
      recoverable: true,
      shouldRetry: true,
      retryDelayMs: 500,
      kind: 'transient',
      message: 'Transient execution failure detected; retry is safe.',
    };
  }

  if (message.includes('tool') || message.includes('spawn') || message.includes('runtime')) {
    return {
      recoverable: true,
      shouldRetry: true,
      retryDelayMs: 250,
      kind: 'tool_error',
      message: 'Tool/runtime failure detected; a bounded retry is allowed.',
    };
  }

  return {
    recoverable: false,
    shouldRetry: false,
    retryDelayMs: 0,
    kind: 'fatal',
    message: readMessage(error),
  };
}

export async function handleRecovery<T>(params: {
  operation: () => Promise<T>;
  maxAttempts?: number;
  onDecision?: (decision: RecoveryDecision, attempt: number) => void | Promise<void>;
}): Promise<T> {
  const maxAttempts = Math.max(1, params.maxAttempts ?? 2);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await params.operation();
    } catch (error) {
      lastError = error;
      const decision = detectRecoverableError(error);
      await params.onDecision?.(decision, attempt);

      if (!decision.recoverable || !decision.shouldRetry || attempt >= maxAttempts) {
        throw error;
      }

      if (decision.retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, decision.retryDelayMs));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
