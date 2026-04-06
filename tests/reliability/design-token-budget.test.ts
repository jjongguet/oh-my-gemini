import { describe, expect, test } from 'vitest';

import type { DesignSystem } from '../../src/design/types.js';
import { buildDesignSection, getInjectionTier } from '../../src/design/token-budget.js';

function makeMinimalDesignSystem(): DesignSystem {
  return {
    sections: [
      {
        heading: 'Visual Theme & Atmosphere',
        category: 'visual-theme',
        content: 'Clean and modern aesthetic.',
      },
    ],
    categories: new Set(['visual-theme']) as ReadonlySet<import('../../src/design/types.js').DesignCategory>,
    tokens: [],
    rules: [],
  };
}

describe('reliability: design-token-budget', () => {
  test('tier 0 agents → getInjectionTier returns 0', () => {
    expect(getInjectionTier('git-master')).toBe(0);
    expect(getInjectionTier('tracer')).toBe(0);
  });

  test('tier 1 agents → getInjectionTier returns 1', () => {
    expect(getInjectionTier('executor')).toBe(1);
    expect(getInjectionTier(undefined)).toBe(1);
  });

  test('tier 2 agents → getInjectionTier returns 2', () => {
    expect(getInjectionTier('designer')).toBe(2);
    expect(getInjectionTier('design-architect')).toBe(2);
  });

  test('buildDesignSection with tier 0 → returns empty string', () => {
    const system = makeMinimalDesignSystem();
    expect(buildDesignSection(system, 0)).toBe('');
  });

  test('buildDesignSection with tier 1 → returns short summary string mentioning categories', () => {
    const system = makeMinimalDesignSystem();
    const result = buildDesignSection(system, 1);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('visual-theme');
  });

  test('buildDesignSection(system, 2) returns full section content', () => {
    const system: DesignSystem = {
      sections: [
        {
          heading: 'Visual Theme & Atmosphere',
          category: 'visual-theme',
          content: 'Clean and modern aesthetic.',
        },
        {
          heading: 'Color Palette & Roles',
          category: 'color-palette',
          content: 'Primary: #3B82F6, Secondary: #10B981.',
        },
      ],
      categories: new Set(['visual-theme', 'color-palette']) as ReadonlySet<import('../../src/design/types.js').DesignCategory>,
      tokens: [],
      rules: [],
    };
    const result = buildDesignSection(system, 2);
    expect(result).toContain('Visual Theme & Atmosphere');
    expect(result).toContain('Color Palette & Roles');
  });

  test('buildDesignSection(system, 2) truncates when exceeding max tokens', () => {
    const longContent = 'x'.repeat(4000);
    const system: DesignSystem = {
      sections: [
        {
          heading: 'Visual Theme & Atmosphere',
          category: 'visual-theme',
          content: longContent,
        },
      ],
      categories: new Set(['visual-theme']) as ReadonlySet<import('../../src/design/types.js').DesignCategory>,
      tokens: [],
      rules: [],
    };
    const result = buildDesignSection(system, 2);
    expect(result.length).toBeLessThanOrEqual(3000);
  });
});
