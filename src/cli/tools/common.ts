import path from 'node:path';

import { createToolTextResult } from '../../mcp/server.js';

export const DEFAULT_TOOL_RESPONSE_LIMIT_BYTES = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${name} must be an object.`);
  }

  return value;
}

export function readString(
  args: Record<string, unknown>,
  name: string,
  options: { required?: boolean; trim?: boolean } = {},
): string | undefined {
  const raw = args[name];

  if (raw == null) {
    if (options.required) {
      throw new Error(`${name} is required.`);
    }
    return undefined;
  }

  if (typeof raw !== 'string') {
    throw new Error(`${name} must be a string.`);
  }

  const value = options.trim === false ? raw : raw.trim();
  if (!value && options.required) {
    throw new Error(`${name} is required.`);
  }

  return value || undefined;
}

export function readBoolean(
  args: Record<string, unknown>,
  name: string,
  defaultValue: boolean,
): boolean {
  const raw = args[name];

  if (raw == null) {
    return defaultValue;
  }

  if (typeof raw !== 'boolean') {
    throw new Error(`${name} must be a boolean.`);
  }

  return raw;
}

export function readNumber(
  args: Record<string, unknown>,
  name: string,
  options: {
    defaultValue?: number;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {},
): number {
  const raw = args[name];
  const value =
    raw == null
      ? options.defaultValue
      : typeof raw === 'number'
        ? raw
        : Number.NaN;

  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`${name} must be a valid number.`);
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }

  if (options.min != null && value < options.min) {
    throw new Error(`${name} must be >= ${options.min}.`);
  }

  if (options.max != null && value > options.max) {
    throw new Error(`${name} must be <= ${options.max}.`);
  }

  return value;
}

export function readStringArray(
  args: Record<string, unknown>,
  name: string,
  options: { defaultValue?: string[] } = {},
): string[] {
  const raw = args[name];

  if (raw == null) {
    return options.defaultValue ? [...options.defaultValue] : [];
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${name} must be a string or string array.`);
  }

  const result: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') {
      throw new Error(`${name} must contain only strings.`);
    }
    const trimmed = value.trim();
    if (trimmed) {
      result.push(trimmed);
    }
  }

  return result;
}

export function readStringMap(
  args: Record<string, unknown>,
  name: string,
): Record<string, string> {
  const raw = args[name];

  if (raw == null) {
    return {};
  }

  const record = readRecord(raw, name);
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'string') {
      throw new Error(`${name}.${key} must be a string.`);
    }
    normalized[key] = value;
  }

  return normalized;
}

export function resolveWorkingDirectory(
  args: Record<string, unknown>,
  defaultCwd: string,
): string {
  const requested = readString(args, 'workingDirectory');
  if (!requested) {
    return defaultCwd;
  }

  if (path.isAbsolute(requested)) {
    return path.resolve(requested);
  }

  return path.resolve(defaultCwd, requested);
}

export function createJsonResult(value: unknown): ReturnType<typeof createToolTextResult> {
  return createToolTextResult(JSON.stringify(value));
}

export function truncateText(value: string, maxBytes = DEFAULT_TOOL_RESPONSE_LIMIT_BYTES): string {
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength <= maxBytes) {
    return value;
  }

  let end = value.length;
  let truncated = value;

  while (end > 0 && Buffer.byteLength(truncated, 'utf8') > maxBytes) {
    end -= 1;
    truncated = value.slice(0, end);
  }

  return `${truncated}\n\n[omp-truncated: original_bytes=${byteLength} limit_bytes=${maxBytes}]`;
}
