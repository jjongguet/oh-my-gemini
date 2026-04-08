import { describe, expect, test } from 'vitest';

import type { DesignSystem } from '../../src/design/types.js';
import { STITCH_CATEGORIES, validateDesignSystem } from '../../src/design/validator.js';

function makeDesignSystem(categoryNames: string[]): DesignSystem {
  const categories = new Set(categoryNames) as unknown as ReadonlySet<import('../../src/design/types.js').DesignCategory>;
  const sections = categoryNames.map((cat) => ({
    heading: cat,
    category: cat as import('../../src/design/types.js').DesignCategory,
    content: `Content for ${cat}`,
  }));
  return {
    sections,
    categories,
    tokens: [],
    rules: [],
  };
}

describe('reliability: design-validator', () => {
  test('lenient mode: passes when system has at least one section', () => {
    const system = makeDesignSystem(['visual-theme']);
    const result = validateDesignSystem(system);
    expect(result.valid).toBe(true);
  });

  test('strict mode: fails when canonical categories are missing, reports each as error finding', () => {
    // Only one category present — all others missing
    const system = makeDesignSystem(['visual-theme']);
    const result = validateDesignSystem(system, { strict: true });
    expect(result.valid).toBe(false);

    const missingCategories = STITCH_CATEGORIES.filter((c) => c !== 'visual-theme');
    const errorFindings = result.findings.filter((f) => f.severity === 'error');
    for (const missing of missingCategories) {
      expect(errorFindings.some((f) => f.category === missing)).toBe(true);
    }
  });

  test('strict mode: passes when all canonical categories present', () => {
    const system = makeDesignSystem([...STITCH_CATEGORIES]);
    const result = validateDesignSystem(system, { strict: true });
    expect(result.valid).toBe(true);
    expect(result.findings.filter((f) => f.severity === 'error')).toHaveLength(0);
  });

  test('lenient mode with empty sections array → valid: false (no sections)', () => {
    const system: DesignSystem = {
      sections: [],
      categories: new Set() as ReadonlySet<import('../../src/design/types.js').DesignCategory>,
      tokens: [],
      rules: [],
    };
    const result = validateDesignSystem(system);
    expect(result.valid).toBe(false);
  });
});
