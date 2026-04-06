import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { executeDesignInitCommand } from '../../src/cli/commands/design-init.js';
import { executeDesignValidateCommand } from '../../src/cli/commands/design-validate.js';
import { parseDesignMd } from '../../src/design/parser.js';
import { generateDesignTemplate } from '../../src/design/template-generator.js';
import { validateDesignSystem } from '../../src/design/validator.js';

const FULL_SECTION_HEADERS = [
  '## Visual Theme & Atmosphere',
  '## Color Palette & Roles',
  '## Typography Rules',
  '## Component Stylings',
  '## Layout & Spacing',
  '## Depth & Elevation',
  "## Do's / Don'ts",
  '## Responsive Behavior',
];

describe('smoke: design commands', () => {
  test('generateDesignTemplate({ template: "full" }) produces content containing all section headers', () => {
    const content = generateDesignTemplate({ template: 'full' });
    for (const header of FULL_SECTION_HEADERS) {
      expect(content).toContain(header);
    }
  });

  test('generateDesignTemplate({ template: "minimal" }) produces content containing "Visual Theme"', () => {
    const content = generateDesignTemplate({ template: 'minimal' });
    expect(content).toContain('Visual Theme');
  });

  test('parseDesignMd(generateDesignTemplate({ template: "full" })) returns non-null with all sections', () => {
    const content = generateDesignTemplate({ template: 'full' });
    const system = parseDesignMd(content);
    expect(system).not.toBeNull();
    expect(system!.sections.length).toBe(FULL_SECTION_HEADERS.length);
  });

  test('generated full template passes validation in lenient mode', () => {
    const content = generateDesignTemplate({ template: 'full' });
    const system = parseDesignMd(content);
    expect(system).not.toBeNull();
    const result = validateDesignSystem(system!);
    expect(result.valid).toBe(true);
  });

  test('executeDesignInitCommand creates DESIGN.md', async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'omg-test-init-'));
    const io = { stdout: () => {}, stderr: () => {} };
    try {
      const result = await executeDesignInitCommand([], { cwd: tmpDir, io });
      expect(result.exitCode).toBe(0);
      await expect(access(path.join(tmpDir, 'DESIGN.md'))).resolves.toBeUndefined();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('executeDesignValidateCommand passes on valid DESIGN.md', async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'omg-test-validate-'));
    const io = { stdout: () => {}, stderr: () => {} };
    try {
      const content = generateDesignTemplate({ template: 'full' });
      await writeFile(path.join(tmpDir, 'DESIGN.md'), content, 'utf8');
      await mkdir(path.join(tmpDir, '.git'));
      const result = await executeDesignValidateCommand([], { cwd: tmpDir, io });
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('executeDesignValidateCommand fails when no DESIGN.md', async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'omg-test-nodesign-'));
    const io = { stdout: () => {}, stderr: () => {} };
    try {
      await mkdir(path.join(tmpDir, '.git'));
      const result = await executeDesignValidateCommand([], { cwd: tmpDir, io });
      expect(result.exitCode).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
