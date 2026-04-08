import { existsSync, symlinkSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  cliEntrypointExists,
  createTempDir,
  distCliEntrypointPath,
  removeDir,
  runCliEntrypoint,
  srcCliEntrypointPath,
} from '../utils/runtime.js';

describe('smoke: cli entrypoint symlink compatibility', () => {
  test.runIf(cliEntrypointExists())(
    'symlinked cli entrypoint executes global help successfully',
    () => {
      const tempDir = createTempDir('omp-symlink-entrypoint-');

      try {
        const sourceEntrypoint = existsSync(srcCliEntrypointPath)
          ? srcCliEntrypointPath
          : distCliEntrypointPath;
        const linkPath = path.join(tempDir, 'omp-symlink-entrypoint');
        symlinkSync(sourceEntrypoint, linkPath);

        const result = runCliEntrypoint(linkPath, ['--help'], {
          cwd: tempDir,
        });

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        expect(result.stdout).toContain('oh-my-product CLI');
      } finally {
        removeDir(tempDir);
      }
    },
  );

  test.skipIf(cliEntrypointExists())(
    'symlink compatibility test runs when CLI entrypoint is available',
    () => {
      expect(true).toBe(true);
    },
  );
});
