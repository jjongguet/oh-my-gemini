import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { createFileTools } from '../../src/tools/file-tools.js';
import type { OmpToolDefinition, OmpToolRequestContext } from '../../src/tools/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function makeContext(cwd: string): OmpToolRequestContext {
  return {
    cwd,
    signal: new AbortController().signal,
    requestId: 'test',
    sessionId: 'test-session',
  };
}

function findTool(tools: OmpToolDefinition[], name: string): OmpToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }

  return tool;
}

describe('reliability: file tools', () => {
  test('supports list/read/write/stat inside allowed root', async () => {
    const root = createTempDir('omp-file-tools-');

    try {
      const tools = createFileTools({ rootDir: root });
      const context = makeContext(root);
      const writeTool = findTool(tools, 'file_write');
      const listTool = findTool(tools, 'file_list');
      const readTool = findTool(tools, 'file_read');
      const statTool = findTool(tools, 'file_stat');

      await writeTool.handler(
        {
          path: 'notes/todo.txt',
          content: 'hello tools',
        },
        context,
      );

      const listResultRaw = await listTool.handler({ path: 'notes' }, context);
      const listResult = JSON.parse(typeof listResultRaw === 'string' ? listResultRaw : listResultRaw.text) as {
        entries: Array<{ name: string }>;
      };
      expect(listResult.entries.some((entry) => entry.name === 'todo.txt')).toBe(true);

      const readResultRaw = await readTool.handler({ path: 'notes/todo.txt' }, context);
      const readResult = JSON.parse(typeof readResultRaw === 'string' ? readResultRaw : readResultRaw.text) as {
        content: string;
      };
      expect(readResult.content).toBe('hello tools');

      const statResultRaw = await statTool.handler({ path: 'notes/todo.txt' }, context);
      const statResult = JSON.parse(typeof statResultRaw === 'string' ? statResultRaw : statResultRaw.text) as {
        type: string;
        size: number;
      };
      expect(statResult.type).toBe('file');
      expect(statResult.size).toBeGreaterThan(0);

      const onDisk = await fs.readFile(path.join(root, 'notes', 'todo.txt'), 'utf8');
      expect(onDisk).toBe('hello tools');
    } finally {
      removeDir(root);
    }
  });

  test('blocks path traversal outside allowed root', async () => {
    const root = createTempDir('omp-file-tools-path-');

    try {
      const tools = createFileTools({ rootDir: root });
      const context = makeContext(root);
      const readTool = findTool(tools, 'file_read');

      await expect(
        readTool.handler({ path: '../outside.txt' }, context),
      ).rejects.toThrow(/escapes allowed root directory/i);
    } finally {
      removeDir(root);
    }
  });
});
