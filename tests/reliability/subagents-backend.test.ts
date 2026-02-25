import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { SubagentsRuntimeBackend } from '../../src/team/runtime/subagents-backend.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

const EXPERIMENTAL_FLAGS = [
  'OMG_EXPERIMENTAL_ENABLE_AGENTS',
  'GEMINI_EXPERIMENTAL_ENABLE_AGENTS',
] as const;

async function withExperimentalFlagsCleared<T>(
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const flag of EXPERIMENTAL_FLAGS) {
    previous.set(flag, process.env[flag]);
    delete process.env[flag];
  }

  try {
    return await run();
  } finally {
    for (const flag of EXPERIMENTAL_FLAGS) {
      const prior = previous.get(flag);
      if (prior === undefined) {
        delete process.env[flag];
      } else {
        process.env[flag] = prior;
      }
    }
  }
}

async function seedSubagentWorkspace(rootDir: string): Promise<void> {
  const geminiDir = path.join(rootDir, '.gemini');
  const agentsDir = path.join(geminiDir, 'agents');
  await fs.mkdir(agentsDir, { recursive: true });

  await fs.writeFile(
    path.join(geminiDir, 'settings.json'),
    JSON.stringify(
      {
        experimental: {
          enableAgents: true,
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    path.join(agentsDir, 'catalog.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        unifiedModel: 'gemini-2.5-pro',
        subagents: [
          {
            id: 'planner',
            role: 'planner',
            mission: 'Draft an execution plan.',
          },
          {
            id: 'executor',
            role: 'executor',
            mission: 'Apply the implementation changes.',
          },
          {
            id: 'verifier',
            role: 'verifier',
            mission: 'Validate the final result.',
          },
        ],
      },
      null,
      2,
    ),
  );
}

describe('reliability: subagents runtime backend', () => {
  test('probePrerequisites fails without experimental opt-in', async () => {
    const tempRoot = createTempDir('omg-subagents-probe-');

    try {
      const backend = new SubagentsRuntimeBackend();

      const probe = await withExperimentalFlagsCleared(() =>
        backend.probePrerequisites(tempRoot),
      );

      expect(probe.ok).toBe(false);
      expect(probe.issues.join('\n')).toMatch(/experimental/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('startTeam + monitorTeam runs deterministic selected subagents', async () => {
    const tempRoot = createTempDir('omg-subagents-deterministic-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'implement explicit role assignment',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['planner', 'executor'],
        }),
      );

      const snapshot = await backend.monitorTeam(handle);

      expect(snapshot.status).toBe('completed');
      expect(snapshot.workers.map((worker) => worker.workerId)).toStrictEqual([
        'subagent-planner',
        'subagent-executor',
      ]);
      expect(snapshot.summary).toMatch(/planner, executor/i);
      expect(
        snapshot.workers.every((worker) =>
          (worker.details ?? '').includes('model=gemini-2.5-pro'),
        ),
      ).toBe(true);

      expect(
        JSON.stringify(handle.runtime),
      ).toMatch(/selectedSubagents|catalogPath|unifiedModel/);

      await backend.shutdownTeam(handle);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('startTeam fails with actionable error for unknown subagents', async () => {
    const tempRoot = createTempDir('omg-subagents-unknown-role-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      await expect(
        withExperimentalFlagsCleared(() =>
          backend.startTeam({
            teamName: 'phase-c-subagents',
            task: 'unknown-role-test',
            cwd: tempRoot,
            backend: 'subagents',
            subagents: ['planner', 'does-not-exist'],
          }),
        ),
      ).rejects.toThrow(/unknown subagent id\(s\).+does-not-exist/i);
    } finally {
      removeDir(tempRoot);
    }
  });
});
