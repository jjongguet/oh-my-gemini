import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  loadSubagentCatalog,
  resolveSubagentSelection,
} from '../../src/team/subagents-catalog.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

async function writeCatalog(tempRoot: string, rawCatalog: unknown): Promise<void> {
  const agentsDir = path.join(tempRoot, '.gemini', 'agents');
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.writeFile(
    path.join(agentsDir, 'catalog.json'),
    JSON.stringify(rawCatalog, null, 2),
    'utf8',
  );
}

describe('reliability: subagent catalog aliases', () => {
  test('resolves aliases to canonical ids and deduplicates canonical selection', async () => {
    const tempRoot = createTempDir('omg-subagents-catalog-aliases-');

    try {
      await writeCatalog(tempRoot, {
        schemaVersion: 1,
        unifiedModel: 'gemini-2.5-pro',
        subagents: [
          {
            id: 'planner',
            role: 'planner',
            aliases: ['plan'],
            mission: 'Plan work.',
          },
          {
            id: 'code-reviewer',
            role: 'code-reviewer',
            aliases: ['review'],
            mission: 'Review code.',
          },
        ],
      });

      const catalog = await loadSubagentCatalog(tempRoot);
      const resolved = resolveSubagentSelection(catalog, [
        'plan',
        'review',
        'code-reviewer',
      ]);

      expect(resolved.map((entry) => entry.id)).toStrictEqual([
        'planner',
        'code-reviewer',
      ]);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('fails fast when aliases collide between different subagents', async () => {
    const tempRoot = createTempDir('omg-subagents-catalog-alias-collision-');

    try {
      await writeCatalog(tempRoot, {
        schemaVersion: 1,
        unifiedModel: 'gemini-2.5-pro',
        subagents: [
          {
            id: 'planner',
            role: 'planner',
            aliases: ['review'],
            mission: 'Plan work.',
          },
          {
            id: 'code-reviewer',
            role: 'code-reviewer',
            aliases: ['review'],
            mission: 'Review code.',
          },
        ],
      });

      await expect(loadSubagentCatalog(tempRoot)).rejects.toThrow(
        /token "review".+conflicts/i,
      );
    } finally {
      removeDir(tempRoot);
    }
  });

  test('reports alias hints when requested ids are unknown', async () => {
    const tempRoot = createTempDir('omg-subagents-catalog-alias-hints-');

    try {
      await writeCatalog(tempRoot, {
        schemaVersion: 1,
        unifiedModel: 'gemini-2.5-pro',
        subagents: [
          {
            id: 'planner',
            role: 'planner',
            aliases: 'plan',
            mission: 'Plan work.',
          },
          {
            id: 'verifier',
            role: 'verifier',
            aliases: ['verify'],
            mission: 'Verify work.',
          },
        ],
      });

      const catalog = await loadSubagentCatalog(tempRoot);

      expect(() => resolveSubagentSelection(catalog, ['unknown-role'])).toThrow(
        /supported skill aliases: .*plan.*verify/i,
      );
    } finally {
      removeDir(tempRoot);
    }
  });
});
