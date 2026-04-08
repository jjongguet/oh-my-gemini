import { createRequire } from 'node:module';

import { describe, expect, test } from 'vitest';

import { repoRoot, runOmp } from '../utils/runtime.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

describe('smoke: cli version flag', () => {
  test('omp --version prints version string and exits 0', () => {
    const result = runOmp(['--version'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });

  test('omp -V prints version string and exits 0', () => {
    const result = runOmp(['-V'], {
      cwd: repoRoot,
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });
});
