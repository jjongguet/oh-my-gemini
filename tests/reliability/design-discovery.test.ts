import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { discoverDesignMd } from '../../src/design/design-discovery.js';

describe('reliability: design-discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'omp-design-discovery-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('returns path when DESIGN.md exists in the given directory', async () => {
    const designPath = join(tempDir, 'DESIGN.md');
    await writeFile(designPath, '# DESIGN.md\n\n## Visual Theme\nTest', 'utf8');

    // Create a .git dir so the walker stops here and doesn't go up to repo root
    await mkdir(join(tempDir, '.git'));

    const result = await discoverDesignMd(tempDir);
    expect(result).toBe(designPath);
  });

  test('returns null when no DESIGN.md exists in empty temp dir', async () => {
    // Create a .git boundary so the walker stops at tempDir
    await mkdir(join(tempDir, '.git'));

    const result = await discoverDesignMd(tempDir);
    expect(result).toBeNull();
  });

  test('does not throw on invalid/nonexistent path → returns null', async () => {
    const nonExistent = join(tempDir, 'does', 'not', 'exist');
    await expect(discoverDesignMd(nonExistent)).resolves.toBeNull();
  });
});
