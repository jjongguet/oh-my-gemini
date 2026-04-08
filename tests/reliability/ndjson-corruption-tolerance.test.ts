import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { readNdjsonFile } from '../../src/state/filesystem.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: ndjson corruption tolerance', () => {
  test('readNdjsonFile skips malformed lines without throwing', async () => {
    const tempRoot = createTempDir('omp-ndjson-corruption-');

    try {
      const filePath = path.join(tempRoot, 'events.ndjson');
      await fs.writeFile(filePath, '{"id":1}\n{"id":\n{"id":2}\n', 'utf8');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const rows = await readNdjsonFile<{ id: number }>(filePath);

      expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(
        /\[readNdjsonFile\] Skipping malformed line/,
      );
    } finally {
      vi.restoreAllMocks();
      removeDir(tempRoot);
    }
  });

  test('readNdjsonFile returns empty array for ENOENT', async () => {
    const tempRoot = createTempDir('omp-ndjson-enoent-');

    try {
      const filePath = path.join(tempRoot, 'missing.ndjson');
      await expect(readNdjsonFile(filePath)).resolves.toEqual([]);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readNdjsonFile throws for permission errors', async () => {
    const tempRoot = createTempDir('omp-ndjson-permission-');

    try {
      const filePath = path.join(tempRoot, 'events.ndjson');
      const permissionError = new Error(
        'EACCES: permission denied, open file',
      ) as NodeJS.ErrnoException;
      permissionError.code = 'EACCES';

      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(permissionError);

      await expect(readNdjsonFile(filePath)).rejects.toThrow(
        `Failed to read NDJSON file at ${filePath}: ${permissionError.message}`,
      );
    } finally {
      vi.restoreAllMocks();
      removeDir(tempRoot);
    }
  });
});
