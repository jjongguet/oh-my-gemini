import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoRoot } from '../utils/runtime.js';

const REQUIRED_PROMPTS = [
  'plan',
  'execute',
  'review',
  'architect',
  'test',
  'verify',
  'debug',
  'status',
  'handoff',
  'explore',
] as const;

describe('reliability: prompt catalog', () => {
  test('required worker prompt files exist with role description and system prompt sections', () => {
    for (const promptName of REQUIRED_PROMPTS) {
      const promptPath = path.join(repoRoot, 'src', 'prompts', `${promptName}.md`);
      expect(existsSync(promptPath), `missing prompt ${promptName}`).toBe(true);

      const content = readFileSync(promptPath, 'utf8');
      expect(content).toContain('## Role Description');
      expect(content).toContain('## System Prompt');
      expect(content).toMatch(/system prompt/i);
    }
  });

  test('package publish files include src/prompts', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    ) as { files?: string[] };

    expect(packageJson.files).toContain('src/prompts/');
  });
});
