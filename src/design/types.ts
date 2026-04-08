/**
 * Core type definitions for the DESIGN.md design system module.
 * Follows Google Stitch 9-category DESIGN.md format.
 */

/** A single design token (color, spacing, typography value, etc.) */
export interface DesignToken {
  /** Token name, e.g. "primary-color", "heading-font" */
  readonly name: string;
  /** Raw value from DESIGN.md, e.g. "#3B82F6", "Inter, sans-serif" */
  readonly value: string;
  /** Which category this token was extracted from */
  readonly category: DesignCategory;
}

/** A design rule or guideline from Do's/Don'ts or other sections */
export interface DesignRule {
  /** The rule text */
  readonly text: string;
  /** Whether this is a "do" or "don't" directive, or a general rule */
  readonly type: 'do' | 'dont' | 'general';
}

/**
 * The 9 Google Stitch DESIGN.md categories.
 * Additional custom sections are captured under 'other'.
 */
export type DesignCategory =
  | 'visual-theme'
  | 'color-palette'
  | 'typography'
  | 'component-stylings'
  | 'layout-spacing'
  | 'depth-elevation'
  | 'dos-donts'
  | 'responsive-behavior'
  | 'other';

/** Content of a single DESIGN.md section */
export interface DesignSection {
  /** The original heading text from the markdown */
  readonly heading: string;
  /** The normalized category this section maps to */
  readonly category: DesignCategory;
  /** Raw markdown content of the section (excluding the heading) */
  readonly content: string;
}

/** Parsed representation of a DESIGN.md file */
export interface DesignSystem {
  /** All parsed sections, ordered as they appear in the file */
  readonly sections: readonly DesignSection[];
  /** Quick lookup: which categories are present */
  readonly categories: ReadonlySet<DesignCategory>;
  /** Extracted design tokens (populated by token-extractor) */
  readonly tokens: readonly DesignToken[];
  /** Extracted design rules (populated by token-extractor) */
  readonly rules: readonly DesignRule[];
  /** Original file path, if known */
  readonly filePath?: string;
}

/** Validation severity levels */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/** A single validation finding */
export interface ValidationFinding {
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly category?: DesignCategory;
}

/** Result of validating a DesignSystem */
export interface ValidationResult {
  readonly valid: boolean;
  readonly findings: readonly ValidationFinding[];
}
