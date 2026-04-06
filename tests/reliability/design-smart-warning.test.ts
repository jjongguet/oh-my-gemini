import { describe, expect, test } from 'vitest';

import { detectUiTask, getDesignWarning } from '../../src/design/smart-warning.js';

describe('reliability: design-smart-warning', () => {
  test('returns true for "Add a React component" (contains React)', () => {
    expect(detectUiTask('Add a React component')).toBe(true);
  });

  test('returns true for "Fix CSS layout" (contains CSS, layout)', () => {
    expect(detectUiTask('Fix CSS layout')).toBe(true);
  });

  test('returns false for "Fix database query timeout"', () => {
    expect(detectUiTask('Fix database query timeout')).toBe(false);
  });

  test('returns false for "Update API endpoint"', () => {
    expect(detectUiTask('Update API endpoint')).toBe(false);
  });

  test('case insensitive: returns true for "add a BUTTON to the navbar"', () => {
    expect(detectUiTask('add a BUTTON to the navbar')).toBe(true);
  });

  test('getDesignWarning returns non-empty string containing "omg design init"', () => {
    const warning = getDesignWarning();
    expect(warning.length).toBeGreaterThan(0);
    expect(warning).toContain('omg design init');
  });
});
