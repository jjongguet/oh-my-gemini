/**
 * Token and rule extractor for parsed DesignSystem sections.
 * Converts raw section content into structured DesignToken and DesignRule arrays.
 *
 * Design decisions:
 * - Regex-based (no external dependencies)
 * - Returns empty arrays on any failure (never throws)
 * - Handles partial or malformed content gracefully
 */

import type { DesignCategory, DesignRule, DesignSection, DesignSystem, DesignToken } from './types.js';

/**
 * Patterns for extracting color tokens.
 * Matches: `name: #hex`, `name: rgb(...)`, `--css-var: value`
 */
const COLOR_PATTERNS: readonly RegExp[] = [
  /^\s*[-*]?\s*([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/gm,
  /^\s*[-*]?\s*([\w-]+)\s*:\s*(rgba?\([^)]+\))/gm,
  /^\s*[-*]?\s*([\w-]+)\s*:\s*(hsl[a]?\([^)]+\))/gm,
  /^\s*(--[\w-]+)\s*:\s*([^;\n]+)/gm,
];

/**
 * Patterns for extracting typography tokens.
 * Matches font-family, font-size, font-weight, line-height values.
 */
const TYPOGRAPHY_PATTERNS: readonly RegExp[] = [
  /^\s*[-*]?\s*(font-family|font-size|font-weight|line-height|letter-spacing|[\w-]+-font(?:-[\w]+)?)\s*:\s*([^\n]+)/gim,
  /^\s*[-*]?\s*([\w-]+)\s*:\s*(\d+(?:px|rem|em|pt|%)|[A-Z][a-zA-Z\s,]+(?:sans-serif|serif|monospace|cursive|fantasy))/gm,
];

/**
 * Patterns for extracting layout/spacing tokens.
 * Matches spacing, gap, margin, padding values with units.
 */
const SPACING_PATTERNS: readonly RegExp[] = [
  /^\s*[-*]?\s*([\w-]*(?:spacing|gap|margin|padding|gutter|inset|size|width|height|radius|border)[\w-]*)\s*:\s*([^\n]+)/gim,
  /^\s*[-*]?\s*([\w-]+)\s*:\s*(\d+(?:px|rem|em|vh|vw|%)(?:\s+\d+(?:px|rem|em|vh|vw|%))*)/gm,
];

/**
 * Patterns for extracting component styling tokens.
 * Matches: `component-name: style-value`, `--component-var: value`, `component-name { property: value }`
 */
const COMPONENT_PATTERNS: readonly RegExp[] = [
  /^\s*[-*]?\s*([\w-]+)\s*:\s*([\w-]+(?:\s+[\w-]+)*)/gm,
  /^\s*(--[\w-]+)\s*:\s*([^;\n]+)/gm,
  /^\s*([\w-]+)\s*\{\s*[\w-]+\s*:\s*([^}]+)\}/gm,
];

/**
 * Extract tokens from content using a list of regex patterns.
 * Each pattern must have two capturing groups: name and value.
 * Deduplicated by name within this call.
 */
function extractWithPatterns(
  content: string,
  patterns: readonly RegExp[],
  category: DesignCategory,
): DesignToken[] {
  const seen = new Set<string>();
  const tokens: DesignToken[] = [];

  for (const pattern of patterns) {
    // Reset lastIndex since we reuse compiled regexes via the const arrays
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const name = match[1]?.trim();
      const value = match[2]?.trim();
      if (name && value && !seen.has(name)) {
        seen.add(name);
        tokens.push({ name, value, category });
      }
    }
  }

  return tokens;
}

/**
 * Extract all design tokens from a DesignSystem.
 *
 * Processes color-palette, typography, and layout-spacing sections.
 * Returns an empty array if no tokens are found. Never throws.
 */
export function extractDesignTokens(system: DesignSystem): DesignToken[] {
  const tokens: DesignToken[] = [];

  for (const section of system.sections) {
    const { category, content } = section;

    if (category === 'color-palette') {
      tokens.push(...extractWithPatterns(content, COLOR_PATTERNS, 'color-palette'));
    } else if (category === 'typography') {
      tokens.push(...extractWithPatterns(content, TYPOGRAPHY_PATTERNS, 'typography'));
    } else if (category === 'layout-spacing') {
      tokens.push(...extractWithPatterns(content, SPACING_PATTERNS, 'layout-spacing'));
    } else if (category === 'component-stylings') {
      tokens.push(...extractWithPatterns(content, COMPONENT_PATTERNS, 'component-stylings'));
    }
  }

  return tokens;
}

/**
 * Classify a single line from a Do's/Don'ts section.
 * Returns null if the line is empty or a heading.
 */
function classifyRuleLine(line: string): DesignRule | null {
  const trimmed = line.trim();
  if (!trimmed || /^#+/.test(trimmed)) return null;

  if (/^(Do:|✓|- Do\b)/i.test(trimmed)) {
    return { text: trimmed, type: 'do' };
  }

  if (/^(Don'?t:|✗|- Don'?t\b)/i.test(trimmed)) {
    return { text: trimmed, type: 'dont' };
  }

  // Other bullet points in rule sections
  if (/^[-*•]/.test(trimmed)) {
    return { text: trimmed, type: 'general' };
  }

  return null;
}

/**
 * Extract design rules from the dos-donts section of a DesignSystem.
 * Returns an empty array if no rules are found. Never throws.
 */
export function extractDesignRules(system: DesignSystem): DesignRule[] {
  const rules: DesignRule[] = [];

  const ruleSection: DesignSection | undefined = system.sections.find(
    (s) => s.category === 'dos-donts',
  );

  if (!ruleSection) return rules;

  const lines = ruleSection.content.split('\n');
  for (const line of lines) {
    const rule = classifyRuleLine(line);
    if (rule) {
      rules.push(rule);
    }
  }

  return rules;
}
