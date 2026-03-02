import {
  isTeamNameNormalizationError,
  normalizeTeamNameCanonical,
  type TeamNameNormalizationReason,
} from '../../common/team-name.js';
import {
  CONTROL_PLANE_FAILURE_CODES,
  createControlPlaneFailure,
} from './failure-taxonomy.js';

const MAX_IDENTIFIER_LENGTH = 128;
const PATH_SEPARATOR_PATTERN = /[\\/]/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function normalizeRequiredString(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_EMPTY,
      `${label} cannot be empty.`,
    );
  }

  return normalized;
}

export function normalizeSafeIdentifier(label: string, value: string): string {
  const normalized = normalizeRequiredString(label, value);

  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_TOO_LONG,
      `${label} exceeds max length ${MAX_IDENTIFIER_LENGTH}.`,
    );
  }

  if (normalized === '.' || normalized === '..') {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL,
      `${label} cannot be "." or "..".`,
    );
  }

  if (PATH_SEPARATOR_PATTERN.test(normalized)) {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL,
      `${label} cannot contain path separators.`,
    );
  }

  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) {
    throw createControlPlaneFailure(
      CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_INVALID,
      `${label} must use only letters, numbers, ".", "_", or "-".`,
    );
  }

  return normalized;
}

export function normalizeTeamName(value: string): string {
  try {
    return normalizeTeamNameCanonical(value);
  } catch (error) {
    if (isTeamNameNormalizationError(error)) {
      throw createControlPlaneFailure(
        mapTeamNameReasonToControlPlaneFailureCode(error.reason),
        `teamName ${error.message}`,
      );
    }

    throw error;
  }
}

export function normalizeWorkerName(
  label: 'worker' | 'fromWorker' | 'toWorker',
  value: string,
): string {
  return normalizeSafeIdentifier(label, value);
}

export function normalizeTaskIdentifier(value: string): string {
  const normalized = normalizeRequiredString('taskId', value);
  const candidate = normalized.startsWith('task-')
    ? normalized.slice('task-'.length)
    : normalized;

  return normalizeSafeIdentifier('taskId', candidate);
}

export function normalizeMessageIdentifier(value: string): string {
  return normalizeSafeIdentifier('messageId', value);
}

function mapTeamNameReasonToControlPlaneFailureCode(
  reason: TeamNameNormalizationReason,
): (typeof CONTROL_PLANE_FAILURE_CODES)[
  | 'IDENTIFIER_EMPTY'
  | 'IDENTIFIER_TOO_LONG'
  | 'IDENTIFIER_PATH_TRAVERSAL'
  | 'IDENTIFIER_INVALID'
] {
  switch (reason) {
    case 'empty':
      return CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_EMPTY;
    case 'too_long':
      return CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_TOO_LONG;
    case 'path_traversal':
      return CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_PATH_TRAVERSAL;
    case 'invalid':
      return CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_INVALID;
    default:
      return CONTROL_PLANE_FAILURE_CODES.IDENTIFIER_INVALID;
  }
}
