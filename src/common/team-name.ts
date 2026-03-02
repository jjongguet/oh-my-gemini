const TEAM_NAME_MAX_LENGTH = 128;
const TEAM_NAME_SAFE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const PATH_SEPARATOR_PATTERN = /[\\/]/;

export type TeamNameNormalizationReason =
  | 'empty'
  | 'too_long'
  | 'path_traversal'
  | 'invalid';

export type TeamNameNormalizationError = Error & {
  reason: TeamNameNormalizationReason;
};

function createTeamNameNormalizationError(
  reason: TeamNameNormalizationReason,
  message: string,
): TeamNameNormalizationError {
  const error = new Error(message) as TeamNameNormalizationError;
  error.name = 'TeamNameNormalizationError';
  error.reason = reason;
  return error;
}

export function isTeamNameNormalizationError(
  error: unknown,
): error is TeamNameNormalizationError {
  return (
    error instanceof Error &&
    typeof (error as { reason?: unknown }).reason === 'string'
  );
}

export function normalizeTeamNameCanonical(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw createTeamNameNormalizationError(
      'empty',
      'expected a non-empty team identifier.',
    );
  }

  if (trimmed === '.' || trimmed === '..') {
    throw createTeamNameNormalizationError(
      'path_traversal',
      '"." and ".." are not allowed.',
    );
  }

  if (PATH_SEPARATOR_PATTERN.test(trimmed)) {
    throw createTeamNameNormalizationError(
      'path_traversal',
      'path separators are not allowed.',
    );
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized) {
    throw createTeamNameNormalizationError(
      'invalid',
      'use letters, numbers, ".", "_", or "-" and start with a letter/number.',
    );
  }

  if (normalized.length > TEAM_NAME_MAX_LENGTH) {
    throw createTeamNameNormalizationError(
      'too_long',
      `maximum length is ${TEAM_NAME_MAX_LENGTH} characters.`,
    );
  }

  if (!TEAM_NAME_SAFE_PATTERN.test(normalized)) {
    throw createTeamNameNormalizationError(
      'invalid',
      'use letters, numbers, ".", "_", or "-" and start with a letter/number.',
    );
  }

  return normalized;
}
