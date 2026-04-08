import path from 'node:path';

/**
 * Security validation utilities for oh-my-product
 * Based on OMC/OMX security hardening patterns
 */

// Invalid characters for shell commands
const SHELL_INVALID_CHARS = /[;&|`$(){}[\]<>!#*?~]/;

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = /\.\.[\/\\]|\.\.\\/;

/**
 * Validates that a string doesn't contain shell metacharacters
 */
export function validateShellSafe(input: string, context: string): void {
  if (!input || typeof input !== 'string') {
    throw new Error(`${context}: input must be a non-empty string`);
  }
  if (SHELL_INVALID_CHARS.test(input)) {
    throw new Error(`${context}: contains invalid characters`);
  }
}

/**
 * Validates a path to prevent directory traversal
 */
export function validatePathSafe(inputPath: string, context: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error(`${context}: path must be a non-empty string`);
  }

  // Normalize and resolve
  const resolved = path.resolve(inputPath);
  const normalized = path.normalize(inputPath);

  // Check for path traversal attempts
  if (PATH_TRAVERSAL_PATTERNS.test(normalized)) {
    throw new Error(`${context}: path traversal detected`);
  }

  // Check for null bytes
  if (inputPath.includes('\0')) {
    throw new Error(`${context}: null bytes detected`);
  }

  return resolved;
}

/**
 * Validates a team name for safe usage
 */
export function validateTeamName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Team name must be a non-empty string');
  }
  if (name.length > 64) {
    throw new Error('Team name too long (max 64 chars)');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Team name contains invalid characters (use: a-z, A-Z, 0-9, _, -)');
  }
}

/**
 * Validates a task ID for safe usage
 */
export function validateTaskId(taskId: string): void {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Task ID must be a non-empty string');
  }
  if (taskId.length > 128) {
    throw new Error('Task ID too long (max 128 chars)');
  }
  if (SHELL_INVALID_CHARS.test(taskId)) {
    throw new Error('Task ID contains invalid characters');
  }
}

/**
 * Validates worker count
 */
export function validateWorkerCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > 32) {
    throw new Error('Worker count must be an integer between 1 and 32');
  }
}

/**
 * Validates API key format (basic check)
 */
export function validateApiKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('API key must be a non-empty string');
  }
  if (key.length < 10) {
    throw new Error('API key appears to be too short');
  }
  if (SHELL_INVALID_CHARS.test(key)) {
    throw new Error('API key contains invalid characters');
  }
}
