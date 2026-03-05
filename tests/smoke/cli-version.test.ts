import { createRequire } from 'node:module';

import { describe, expect, test } from 'vitest';

import { repoRoot, runOmg } from '../utils/runtime.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

describe('smoke: cli version flag', () => {
  test('omg --version prints version string and exits 0', () => {
    const result = runOmg(['--version'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });

  test('omg -V prints version string and exits 0', () => {
    const result = runOmg(['-V'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });
});
