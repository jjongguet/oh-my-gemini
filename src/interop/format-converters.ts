import { randomUUID } from 'node:crypto';

import type { PersistedTaskStatus } from '../state/index.js';

export type OmcTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

export type OmpTaskStatus = PersistedTaskStatus;

export interface StatusMappingAnnotation {
  originalSystem: 'omc' | 'omp';
  originalStatus: string;
  mappedStatus: string;
  mappedAt: string;
  lossy: boolean;
}

const OMC_STATUS_VALUES = new Set<OmcTaskStatus>([
  'pending',
  'in_progress',
  'completed',
  'failed',
]);

const OMP_STATUS_VALUES = new Set<OmpTaskStatus>([
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'failed',
  'unknown',
  'cancelled',
  'canceled',
]);

export function isOmpTaskStatus(value: unknown): value is OmpTaskStatus {
  return typeof value === 'string' && OMP_STATUS_VALUES.has(value as OmpTaskStatus);
}

export function isOmcTaskStatus(value: unknown): value is OmcTaskStatus {
  return typeof value === 'string' && OMC_STATUS_VALUES.has(value as OmcTaskStatus);
}

export function omgStatusToOmc(
  status: OmpTaskStatus,
): { status: OmcTaskStatus; annotation: StatusMappingAnnotation } {
  const mappedAt = new Date().toISOString();

  switch (status) {
    case 'pending':
    case 'in_progress':
    case 'completed':
    case 'failed':
      return {
        status,
        annotation: {
          originalSystem: 'omp',
          originalStatus: status,
          mappedStatus: status,
          mappedAt,
          lossy: false,
        },
      };
    default:
      return {
        status: 'pending',
        annotation: {
          originalSystem: 'omp',
          originalStatus: status,
          mappedStatus: 'pending',
          mappedAt,
          lossy: true,
        },
      };
  }
}

function resolveInteropAnnotation(
  metadata: Record<string, unknown> | undefined,
): StatusMappingAnnotation | null {
  const raw = metadata?._interop;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (
    (candidate.originalSystem !== 'omc' && candidate.originalSystem !== 'omp') ||
    typeof candidate.originalStatus !== 'string' ||
    typeof candidate.mappedStatus !== 'string' ||
    typeof candidate.mappedAt !== 'string' ||
    typeof candidate.lossy !== 'boolean'
  ) {
    return null;
  }

  return {
    originalSystem: candidate.originalSystem,
    originalStatus: candidate.originalStatus,
    mappedStatus: candidate.mappedStatus,
    mappedAt: candidate.mappedAt,
    lossy: candidate.lossy,
  };
}

export function omcStatusToOmp(
  status: OmcTaskStatus,
  metadata?: Record<string, unknown>,
): OmpTaskStatus {
  const annotation = resolveInteropAnnotation(metadata);
  if (
    annotation?.lossy &&
    annotation.originalSystem === 'omp' &&
    isOmpTaskStatus(annotation.originalStatus)
  ) {
    return annotation.originalStatus;
  }

  return status;
}

export interface GeminiTextPart {
  text: string;
}

export interface GeminiFunctionCallPart {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GeminiFunctionResponsePart {
  functionResponse: {
    name: string;
    response: Record<string, unknown>;
  };
}

export type GeminiPart =
  | GeminiTextPart
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart;

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: GeminiTextPart[];
  };
  generationConfig?: Record<string, unknown>;
}

export interface InteropTaskPayload {
  id: string;
  type: string;
  description: string;
  status?: string;
  context?: Record<string, unknown>;
  files?: string[];
}

export interface InteropMessagePayload {
  id?: string;
  source: string;
  target: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  read?: boolean;
}

function getGeminiRoleForSource(source: string): GeminiContent['role'] {
  return source.toLowerCase() === 'omp' ? 'model' : 'user';
}

export function interopMessageToGeminiContent(
  message: InteropMessagePayload,
): GeminiContent {
  const text = [
    `source=${message.source}`,
    `target=${message.target}`,
    message.content,
  ].join('\n');

  return {
    role: getGeminiRoleForSource(message.source),
    parts: [{ text }],
  };
}

export function interopTaskToGeminiFunctionCall(
  task: InteropTaskPayload,
  functionName = 'interop_task',
): GeminiContent {
  const args: Record<string, unknown> = {
    id: task.id,
    type: task.type,
    description: task.description,
  };

  if (task.status) {
    args.status = task.status;
  }

  if (task.context) {
    args.context = task.context;
  }

  if (task.files && task.files.length > 0) {
    args.files = task.files;
  }

  return {
    role: 'user',
    parts: [{
      functionCall: {
        name: functionName,
        args,
      },
    }],
  };
}

export function buildGeminiInteropRequest(input: {
  messages?: InteropMessagePayload[];
  tasks?: InteropTaskPayload[];
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
}): GeminiGenerateContentRequest {
  const contents: GeminiContent[] = [
    ...(input.messages ?? []).map((message) => interopMessageToGeminiContent(message)),
    ...(input.tasks ?? []).map((task) => interopTaskToGeminiFunctionCall(task)),
  ];

  return {
    contents,
    ...(input.systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: input.systemInstruction }],
          },
        }
      : {}),
    ...(input.generationConfig ? { generationConfig: input.generationConfig } : {}),
  };
}

export function extractTextFromGeminiContent(content: GeminiContent): string {
  const textParts = content.parts
    .map((part) => ('text' in part ? part.text : ''))
    .filter((part) => part.trim().length > 0);

  return textParts.join('\n').trim();
}

export function geminiContentToInteropMessage(input: {
  content: GeminiContent;
  source: 'omc' | 'omp';
  target: 'omc' | 'omp';
  metadata?: Record<string, unknown>;
}): InteropMessagePayload {
  const now = new Date().toISOString();

  return {
    id: `msg-${randomUUID()}`,
    source: input.source,
    target: input.target,
    content: extractTextFromGeminiContent(input.content),
    metadata: input.metadata,
    timestamp: now,
    read: false,
  };
}

export interface GeminiInteropTaskUpdate {
  taskId: string;
  status?: OmpTaskStatus;
  result?: string;
  error?: string;
}

export function geminiFunctionResponseToTaskUpdate(
  part: GeminiFunctionResponsePart,
): GeminiInteropTaskUpdate | null {
  const response = part.functionResponse.response;
  const taskId = response.taskId;

  if (typeof taskId !== 'string' || !taskId.trim()) {
    return null;
  }

  const status = response.status;
  const result = response.result;
  const error = response.error;

  return {
    taskId: taskId.trim(),
    status: isOmpTaskStatus(status) ? status : undefined,
    result: typeof result === 'string' ? result : undefined,
    error: typeof error === 'string' ? error : undefined,
  };
}
