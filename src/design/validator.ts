import type { DesignCategory, DesignSystem, ValidationFinding, ValidationResult } from './types.js';

/**
 * The 8 canonical Google Stitch categories (excluding 'other').
 */
export const STITCH_CATEGORIES: readonly DesignCategory[] = [
  'visual-theme',
  'color-palette',
  'typography',
  'component-stylings',
  'layout-spacing',
  'depth-elevation',
  'dos-donts',
  'responsive-behavior',
] as const;

/**
 * Validate a parsed DesignSystem against the Google Stitch 9-category format.
 *
 * Lenient mode (default): valid if sections.length > 0, info findings for missing categories.
 * Strict mode: valid only if all 9 canonical categories are present, error findings for missing.
 */
export function validateDesignSystem(
  system: DesignSystem,
  options?: { strict?: boolean },
): ValidationResult {
  const strict = options?.strict ?? false;
  const findings: ValidationFinding[] = [];

  const present = system.categories;

  for (const category of STITCH_CATEGORIES) {
    if (present.has(category)) {
      findings.push({
        severity: 'info',
        message: `Category '${category}' is present.`,
        category,
      });
    } else {
      findings.push({
        severity: strict ? 'error' : 'info',
        message: `Category '${category}' is missing.`,
        category,
      });
    }
  }

  let valid: boolean;
  if (strict) {
    valid = STITCH_CATEGORIES.every((c) => present.has(c));
  } else {
    valid = system.sections.length > 0;
  }

  return { valid, findings };
}
