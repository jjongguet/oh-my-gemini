/**
 * Lightweight regex-based parser for Google Stitch DESIGN.md format.
 * Converts DESIGN.md markdown into a DesignSystem structure.
 *
 * Design decisions:
 * - Regex-based (no external markdown library dependency)
 * - Returns null on any failure (never throws)
 * - Handles partial sections gracefully
 * - HTML is stripped for security
 */

import type { DesignCategory, DesignSection, DesignSystem } from './types.js';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Mapping from heading text patterns to normalized categories.
 * Matches are case-insensitive and use includes/startsWith logic.
 */
const HEADING_TO_CATEGORY: ReadonlyArray<{ pattern: RegExp; category: DesignCategory }> = [
  { pattern: /visual\s*theme/i, category: 'visual-theme' },
  { pattern: /atmosphere/i, category: 'visual-theme' },
  { pattern: /color\s*palette/i, category: 'color-palette' },
  { pattern: /color\s*role/i, category: 'color-palette' },
  { pattern: /typography/i, category: 'typography' },
  { pattern: /component\s*styl/i, category: 'component-stylings' },
  { pattern: /layout/i, category: 'layout-spacing' },
  { pattern: /spacing/i, category: 'layout-spacing' },
  { pattern: /depth/i, category: 'depth-elevation' },
  { pattern: /elevation/i, category: 'depth-elevation' },
  { pattern: /do['']?s?\s*[/&]\s*don['']?t/i, category: 'dos-donts' },
  { pattern: /responsive/i, category: 'responsive-behavior' },
];

function classifyHeading(heading: string): DesignCategory {
  for (const { pattern, category } of HEADING_TO_CATEGORY) {
    if (pattern.test(heading)) {
      return category;
    }
  }
  return 'other';
}

/** Strip HTML tags from content for security */
function stripHtml(content: string): string {
  return content.replace(/<[^>]*>/g, '');
}

/** Find all fenced code block ranges in content */
function findCodeBlockRanges(content: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const re = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

/** Check if a position falls within any code block range */
function isInsideCodeBlock(pos: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some(r => pos >= r.start && pos < r.end);
}

/** Normalize line endings to LF */
function normalizeLine(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parse DESIGN.md content into a DesignSystem.
 *
 * @param content - Raw markdown content of a DESIGN.md file
 * @returns Parsed DesignSystem, or null if content is empty/invalid/too large
 */
export function parseDesignMd(content: string): DesignSystem | null {
  if (!content || content.length === 0) {
    return null;
  }

  if (content.length > MAX_FILE_SIZE) {
    return null;
  }

  const normalized = normalizeLine(content);
  const sanitized = stripHtml(normalized);

  // Split into sections by ## headings (level 2)
  const headingRegex = /^##\s+(.+)$/gm;
  const headings: Array<{ heading: string; index: number }> = [];
  const codeBlockRanges = findCodeBlockRanges(sanitized);

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(sanitized)) !== null) {
    if (isInsideCodeBlock(match.index, codeBlockRanges)) continue;
    const captured = match[1];
    if (captured) {
      headings.push({ heading: captured.trim(), index: match.index });
    }
  }

  if (headings.length === 0) {
    // No ## headings found — check if there's a # heading (title only, no sections)
    if (/^#\s+/m.test(sanitized)) {
      // Has a title but no sections — return empty DesignSystem
      return {
        sections: [],
        categories: new Set(),
        tokens: [],
        rules: [],
      };
    }
    return null;
  }

  const sections: DesignSection[] = [];
  const categories = new Set<DesignCategory>();

  for (let i = 0; i < headings.length; i++) {
    const entry = headings[i];
    if (!entry) continue;
    const { heading, index } = entry;
    const nextEntry = headings[i + 1];
    const nextIndex = nextEntry ? nextEntry.index : sanitized.length;

    // Content starts after the heading line
    const headingLineEnd = sanitized.indexOf('\n', index);
    const contentStart = headingLineEnd === -1 ? sanitized.length : headingLineEnd + 1;
    const sectionContent = sanitized.slice(contentStart, nextIndex).trim();

    const category = classifyHeading(heading);

    // Skip "Agent Prompt Guide" section entirely (prompt injection vector)
    if (/agent\s*prompt\s*guide/i.test(heading)) continue;

    categories.add(category);

    sections.push({
      heading,
      category,
      content: sectionContent,
    });
  }

  return {
    sections,
    categories,
    tokens: [],
    rules: [],
  };
}
