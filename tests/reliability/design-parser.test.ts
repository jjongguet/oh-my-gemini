import { describe, expect, test } from 'vitest';

import { parseDesignMd } from '../../src/design/parser.js';

const FULL_DESIGN_MD = `# DESIGN.md

## Visual Theme & Atmosphere
Clean, modern, and minimal aesthetic with a focus on clarity.

## Color Palette & Roles
Primary: #3B82F6
Secondary: #10B981
Background: #FFFFFF

## Typography Rules
Font family: Inter, sans-serif
Heading size: 2rem
Body size: 1rem

## Component Stylings
Buttons use rounded corners with 8px radius.
Cards have subtle shadows and 16px padding.

## Layout & Spacing
Grid: 12-column layout
Gutter: 24px
Max content width: 1280px

## Depth & Elevation
Shadow levels: 0dp, 1dp, 4dp, 8dp, 16dp
Overlays use 8dp elevation.

## Do's / Don'ts
Do: Use consistent spacing tokens.
Don't: Mix multiple font families.

## Responsive Behavior
Mobile breakpoint: 768px
Tablet breakpoint: 1024px
Desktop: above 1024px
`;

describe('reliability: design-parser', () => {
  test('empty string returns null and does not throw', () => {
    expect(() => parseDesignMd('')).not.toThrow();
    expect(parseDesignMd('')).toBeNull();
  });

  test('section headers only with no content returns sections with empty content', () => {
    const input = [
      '## Visual Theme & Atmosphere',
      '## Color Palette & Roles',
      '## Typography Rules',
    ].join('\n');

    const result = parseDesignMd(input);

    expect(result).not.toBeNull();
    expect(result!.sections).toHaveLength(3);
    for (const section of result!.sections) {
      expect(section.content).toBe('');
    }
  });

  test('partial sections parses only existing categories', () => {
    const input = [
      '## Visual Theme & Atmosphere',
      'Some theme content.',
      '',
      '## Color Palette & Roles',
      'Blue and green.',
      '',
      '## Typography Rules',
      'Inter font.',
    ].join('\n');

    const result = parseDesignMd(input);

    expect(result).not.toBeNull();
    expect(result!.sections).toHaveLength(3);
    expect(result!.categories.size).toBe(3);
    expect(result!.categories.has('visual-theme')).toBe(true);
    expect(result!.categories.has('color-palette')).toBe(true);
    expect(result!.categories.has('typography')).toBe(true);
  });

  test('malformed markdown with no headings returns null', () => {
    const input = 'This is just random text.\nNo headings here.\nJust prose.';

    expect(parseDesignMd(input)).toBeNull();
  });

  test('content exceeding 1MB returns null without throwing', () => {
    const oversized = 'x'.repeat(1024 * 1024 + 1);

    expect(() => parseDesignMd(oversized)).not.toThrow();
    expect(parseDesignMd(oversized)).toBeNull();
  });

  test('unicode, CJK, and emoji content parses correctly', () => {
    const input = '## Visual Theme & Atmosphere\n🎨 한국어 디자인 시스템\n日本語のデザイン\n中文设计系统';

    const result = parseDesignMd(input);

    expect(result).not.toBeNull();
    expect(result!.sections).toHaveLength(1);
    expect(result!.sections[0]!.category).toBe('visual-theme');
    expect(result!.sections[0]!.content).toContain('🎨');
    expect(result!.sections[0]!.content).toContain('한국어');
  });

  test('CRLF line endings parse correctly and match LF result', () => {
    const lf = '## Visual Theme & Atmosphere\nClean design.\n\n## Typography Rules\nInter font.';
    const crlf = lf.replace(/\n/g, '\r\n');

    const lfResult = parseDesignMd(lf);
    const crlfResult = parseDesignMd(crlf);

    expect(crlfResult).not.toBeNull();
    expect(lfResult).not.toBeNull();
    expect(crlfResult!.sections).toHaveLength(lfResult!.sections.length);
    expect(crlfResult!.sections[0]!.heading).toBe(lfResult!.sections[0]!.heading);
    expect(crlfResult!.sections[0]!.content).toBe(lfResult!.sections[0]!.content);
    expect(crlfResult!.sections[1]!.heading).toBe(lfResult!.sections[1]!.heading);
  });

  test('well-formed full DESIGN.md parses all categories with correct mappings', () => {
    const result = parseDesignMd(FULL_DESIGN_MD);

    expect(result).not.toBeNull();
    expect(result!.sections.length).toBeGreaterThan(0);
    expect(result!.tokens).toEqual([]);
    expect(result!.rules).toEqual([]);

    const expectedCategories: string[] = [
      'visual-theme',
      'color-palette',
      'typography',
      'component-stylings',
      'layout-spacing',
      'depth-elevation',
      'dos-donts',
      'responsive-behavior',
    ];

    for (const cat of expectedCategories) {
      expect(result!.categories.has(cat as import('../../src/design/types.js').DesignCategory)).toBe(true);
    }

    const sectionByHeading = Object.fromEntries(
      result!.sections.map((s) => [s.heading, s]),
    );

    expect(sectionByHeading['Visual Theme & Atmosphere']!.category).toBe('visual-theme');
    expect(sectionByHeading['Color Palette & Roles']!.category).toBe('color-palette');
    expect(sectionByHeading['Typography Rules']!.category).toBe('typography');
    expect(sectionByHeading['Component Stylings']!.category).toBe('component-stylings');
    expect(sectionByHeading['Layout & Spacing']!.category).toBe('layout-spacing');
    expect(sectionByHeading['Depth & Elevation']!.category).toBe('depth-elevation');
    expect(sectionByHeading["Do's / Don'ts"]!.category).toBe('dos-donts');
    expect(sectionByHeading['Responsive Behavior']!.category).toBe('responsive-behavior');
  });

  test('title-only file returns DesignSystem with empty sections array', () => {
    const input = '# DESIGN.md\n\nThis file has no section headings.';

    const result = parseDesignMd(input);

    expect(result).not.toBeNull();
    expect(result!.sections).toHaveLength(0);
    expect(result!.categories.size).toBe(0);
    expect(result!.tokens).toEqual([]);
    expect(result!.rules).toEqual([]);
  });
});
