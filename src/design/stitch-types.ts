/**
 * Type definitions and validators for Google Stitch integration responses.
 * Uses manual validation (no zod dependency) for response verification.
 */

/** Maximum allowed response size from Stitch (100KB) */
export const MAX_STITCH_RESPONSE_SIZE = 100 * 1024;

/** A design token from Stitch */
export interface StitchDesignToken {
  readonly name: string;
  readonly value: string;
  readonly category: string;
}

/** Stitch design system response */
export interface StitchDesignSystemResponse {
  readonly name?: string;
  readonly sections: ReadonlyArray<{
    readonly heading: string;
    readonly content: string;
  }>;
  readonly tokens?: readonly StitchDesignToken[];
}

/** Validation result */
export interface StitchValidationResult {
  readonly valid: boolean;
  readonly data?: StitchDesignSystemResponse;
  readonly error?: string;
}

/**
 * Validate a raw response against the StitchDesignSystemResponse shape.
 * Returns typed data if valid, error message if not.
 */
export function validateStitchResponse(raw: unknown): StitchValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj['sections'])) {
    return { valid: false, error: 'Response missing sections array' };
  }

  const sections = obj['sections'] as unknown[];
  for (const section of sections) {
    if (!section || typeof section !== 'object') {
      return { valid: false, error: 'Section is not an object' };
    }
    const s = section as Record<string, unknown>;
    if (typeof s['heading'] !== 'string' || typeof s['content'] !== 'string') {
      return { valid: false, error: 'Section missing heading or content string' };
    }
  }

  // Size check
  const jsonSize = JSON.stringify(raw).length;
  if (jsonSize > MAX_STITCH_RESPONSE_SIZE) {
    return { valid: false, error: `Response exceeds ${MAX_STITCH_RESPONSE_SIZE} byte limit (${jsonSize} bytes)` };
  }

  return { valid: true, data: raw as StitchDesignSystemResponse };
}
