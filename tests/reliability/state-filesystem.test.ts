import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  appendNdjsonFile,
  ensureDirectory,
  readJsonFile,
  readNdjsonFile,
  writeJsonFile,
} from '../../src/state/filesystem.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: state filesystem helpers', () => {
  test('ensureDirectory creates nested directories recursively', async () => {
    const tempRoot = createTempDir('omg-filesystem-ensure-');

    try {
      const nestedDir = path.join(tempRoot, 'a', 'b', 'c');
      await ensureDirectory(nestedDir);

      const stat = await fs.stat(nestedDir);
      expect(stat.isDirectory()).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('writeJsonFile persists newline-terminated JSON and readJsonFile parses it', async () => {
    const tempRoot = createTempDir('omg-filesystem-json-write-');

    try {
      const filePath = path.join(tempRoot, 'state', 'snapshot.json');
      const payload = {
        id: 'snapshot-1',
        status: 'running',
        workers: 2,
      };

      await writeJsonFile(filePath, payload);

      const raw = await fs.readFile(filePath, 'utf8');
      expect(raw.endsWith('\n')).toBe(true);

      const parsed = await readJsonFile<typeof payload>(filePath);
      expect(parsed).toStrictEqual(payload);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readJsonFile returns null for missing files', async () => {
    const tempRoot = createTempDir('omg-filesystem-json-missing-');

    try {
      const filePath = path.join(tempRoot, 'missing.json');
      await expect(readJsonFile(filePath)).resolves.toBeNull();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readJsonFile wraps parse and filesystem errors with path context', async () => {
    const tempRoot = createTempDir('omg-filesystem-json-errors-');

    try {
      const malformedPath = path.join(tempRoot, 'malformed.json');
      await fs.writeFile(malformedPath, '{"broken":', 'utf8');

      await expect(readJsonFile(malformedPath)).rejects.toThrow(
        new RegExp(`Failed to read JSON file at ${malformedPath}`),
      );

      await expect(readJsonFile(tempRoot)).rejects.toThrow(
        new RegExp(`Failed to read JSON file at ${tempRoot}`),
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('appendNdjsonFile appends records and readNdjsonFile reads them back in order', async () => {
    const tempRoot = createTempDir('omg-filesystem-ndjson-append-');

    try {
      const filePath = path.join(tempRoot, 'events', 'audit.ndjson');

      await appendNdjsonFile(filePath, { id: 'e1', action: 'claim' });
      await appendNdjsonFile(filePath, { id: 'e2', action: 'transition' });

      const parsed = await readNdjsonFile<{ id: string; action: string }>(filePath);

      expect(parsed).toStrictEqual([
        { id: 'e1', action: 'claim' },
        { id: 'e2', action: 'transition' },
      ]);
    } finally {
      removeDir(tempRoot);
    }
  });
});
