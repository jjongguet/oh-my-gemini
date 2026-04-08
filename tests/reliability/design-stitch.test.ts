import { describe, expect, test } from 'vitest';

import {
  validateStitchResponse,
  MAX_STITCH_RESPONSE_SIZE,
} from '../../src/design/stitch-types.js';
import {
  extractDesignSystemFromStitch,
  isStitchError,
} from '../../src/design/stitch-bridge.js';

describe('reliability: design stitch integration', () => {
  test('validateStitchResponse accepts valid response', () => {
    const result = validateStitchResponse({
      sections: [{ heading: 'Color', content: 'blue' }],
    });
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  test('validateStitchResponse rejects non-object', () => {
    expect(validateStitchResponse(null).valid).toBe(false);
    expect(validateStitchResponse('string').valid).toBe(false);
    expect(validateStitchResponse(42).valid).toBe(false);
  });

  test('validateStitchResponse rejects missing sections', () => {
    const result = validateStitchResponse({ name: 'test' });
    expect(result.valid).toBe(false);
  });

  test('validateStitchResponse rejects malformed sections', () => {
    const result = validateStitchResponse({ sections: [{ heading: 123 }] });
    expect(result.valid).toBe(false);
  });

  test('validateStitchResponse rejects oversized response', () => {
    const largeContent = 'x'.repeat(MAX_STITCH_RESPONSE_SIZE + 1);
    const result = validateStitchResponse({
      sections: [{ heading: 'Big', content: largeContent }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/size|limit|byte/i);
  });

  test('extractDesignSystemFromStitch returns error when both unavailable', async () => {
    const result = await extractDesignSystemFromStitch('https://example.com/design');
    expect(isStitchError(result)).toBe(true);
    if (isStitchError(result)) {
      expect(result.setupInstructions.length).toBeGreaterThan(0);
    }
  });

  test('isStitchError type guard', () => {
    const errorObj = {
      error: 'something went wrong',
      setupInstructions: 'do this',
    };
    const successObj = {
      source: 'mcp' as const,
      designSystem: { sections: [] },
    };
    expect(isStitchError(errorObj)).toBe(true);
    expect(isStitchError(successObj)).toBe(false);
  });
});
