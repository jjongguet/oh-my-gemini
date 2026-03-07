import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { readHudContext } from '../../src/hud/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: hud state', () => {
  test('tolerates 429-like usage payloads without throwing and marks rate-limited state', async () => {
    const tempRoot = createTempDir('omg-hud-429-');

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'settings.json'),
        JSON.stringify({ model: 'gemini-2.5-pro' }, null, 2),
        'utf8',
      );
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'usage.json'),
        JSON.stringify({ status: 429, error: 'rate limit exceeded' }, null, 2),
        'utf8',
      );

      const context = await readHudContext({ cwd: tempRoot, env: {} as NodeJS.ProcessEnv });

      expect(context.gemini.model).toBe('gemini-2.5-pro');
      expect(context.gemini.rateLimited).toBe(true);
      expect(context.gemini.windowPercent).toBeUndefined();
      expect(context.gemini.quotaPercent).toBeUndefined();
    } finally {
      removeDir(tempRoot);
    }
  });
});
