import { describe, expect, test } from 'vitest';

import { repoRoot, runOmg } from '../utils/runtime.js';

describe('smoke: install-to-setup help contract', () => {
  test('global help states the post-install setup contract', () => {
    const result = runOmg(['--help'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout).toContain('After npm install -g oh-my-gemini, run setup to apply local files');
    expect(result.stdout).toContain('oh-my-gemini setup --scope project');
  });

  test('setup help states both setup entrypoints', () => {
    const result = runOmg(['setup', '--help'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout).toContain('After npm install -g oh-my-gemini, run setup to apply local files');
    expect(result.stdout).toContain('omg setup ... / oh-my-gemini setup ...');
  });
});
