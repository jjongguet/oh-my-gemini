import { describe, expect, test } from 'vitest';

import { extractDesignRules, extractDesignTokens } from '../../src/design/token-extractor.js';
import type { DesignSystem } from '../../src/design/types.js';

describe('reliability: design-token-extractor', () => {
  test('extractDesignTokens with color-palette section extracts named color tokens', () => {
    const system: DesignSystem = {
      sections: [
        {
          heading: 'Color Palette',
          category: 'color-palette',
          content: 'primary: #3B82F6\nsecondary: #10B981',
        },
      ],
      categories: new Set(['color-palette']),
      tokens: [],
      rules: [],
    };

    const tokens = extractDesignTokens(system);

    expect(tokens.length).toBeGreaterThanOrEqual(2);

    const primary = tokens.find((t) => t.name === 'primary');
    expect(primary).toBeDefined();
    expect(primary!.value).toBe('#3B82F6');
    expect(primary!.category).toBe('color-palette');

    const secondary = tokens.find((t) => t.name === 'secondary');
    expect(secondary).toBeDefined();
    expect(secondary!.value).toBe('#10B981');
    expect(secondary!.category).toBe('color-palette');
  });

  test('extractDesignTokens with typography section extracts font-family token', () => {
    const system: DesignSystem = {
      sections: [
        {
          heading: 'Typography Rules',
          category: 'typography',
          content: 'font-family: Inter, sans-serif',
        },
      ],
      categories: new Set(['typography']),
      tokens: [],
      rules: [],
    };

    const tokens = extractDesignTokens(system);

    expect(tokens.length).toBeGreaterThanOrEqual(1);

    const fontFamily = tokens.find((t) => t.name === 'font-family');
    expect(fontFamily).toBeDefined();
    expect(fontFamily!.value).toContain('Inter');
    expect(fontFamily!.category).toBe('typography');
  });

  test('extractDesignTokens with component-stylings section extracts component token', () => {
    const system: DesignSystem = {
      sections: [
        {
          heading: 'Component Stylings',
          category: 'component-stylings',
          content: 'button: rounded-lg bg-blue-500',
        },
      ],
      categories: new Set(['component-stylings']),
      tokens: [],
      rules: [],
    };

    const tokens = extractDesignTokens(system);

    expect(tokens.length).toBeGreaterThanOrEqual(1);

    const button = tokens.find((t) => t.name === 'button');
    expect(button).toBeDefined();
    expect(button!.category).toBe('component-stylings');
  });

  test('extractDesignTokens with empty sections returns empty array without throwing', () => {
    const system: DesignSystem = {
      sections: [],
      categories: new Set(),
      tokens: [],
      rules: [],
    };

    expect(() => extractDesignTokens(system)).not.toThrow();
    expect(extractDesignTokens(system)).toEqual([]);
  });

  test('extractDesignRules with do/dont content extracts rules with correct types', () => {
    const system: DesignSystem = {
      sections: [
        {
          heading: "Do's / Don'ts",
          category: 'dos-donts',
          content: "Do: Use consistent spacing\nDon't: Mix font families",
        },
      ],
      categories: new Set(['dos-donts']),
      tokens: [],
      rules: [],
    };

    const rules = extractDesignRules(system);

    expect(rules.length).toBeGreaterThanOrEqual(2);

    const doRule = rules.find((r) => r.type === 'do');
    expect(doRule).toBeDefined();
    expect(doRule!.text).toContain('Use consistent spacing');

    const dontRule = rules.find((r) => r.type === 'dont');
    expect(dontRule).toBeDefined();
    expect(dontRule!.text).toContain('Mix font families');
  });

  test('extractDesignRules with no rules section returns empty array', () => {
    const system: DesignSystem = {
      sections: [
        {
          heading: 'Color Palette',
          category: 'color-palette',
          content: 'primary: #3B82F6',
        },
      ],
      categories: new Set(['color-palette']),
      tokens: [],
      rules: [],
    };

    expect(() => extractDesignRules(system)).not.toThrow();
    expect(extractDesignRules(system)).toEqual([]);
  });
});
