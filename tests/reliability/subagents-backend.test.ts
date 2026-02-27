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

async function seedSubagentWorkspace(rootDir: string, count = 3): Promise<void> {
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
        subagents: Array.from({ length: count }, (_, index) => {
          const id =
            index === 0
              ? 'planner'
              : index === 1
                ? 'executor'
                : index === 2
                  ? 'verifier'
                  : `role-${index + 1}`;

          return {
            id,
            role: id,
            mission: `Execute responsibilities for ${id}.`,
          };
        }),
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
        'worker-1',
        'worker-2',
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

  test('startTeam selects catalog-first workers when no explicit subagents are provided', async () => {
    const tempRoot = createTempDir('omg-subagents-catalog-first-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'catalog-first-selection',
          cwd: tempRoot,
          backend: 'subagents',
          workers: 2,
        }),
      );

      const snapshot = await backend.monitorTeam(handle);
      expect(snapshot.status).toBe('completed');
      expect(snapshot.workers.map((worker) => worker.workerId)).toStrictEqual([
        'worker-1',
        'worker-2',
      ]);
      expect(snapshot.summary).toMatch(/planner, executor/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('startTeam fails when requested workers exceed catalog entries', async () => {
    const tempRoot = createTempDir('omg-subagents-worker-overflow-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      await expect(
        withExperimentalFlagsCleared(() =>
          backend.startTeam({
            teamName: 'phase-c-subagents',
            task: 'overflow-selection',
            cwd: tempRoot,
            backend: 'subagents',
            workers: 4,
          }),
        ),
      ).rejects.toThrow(/catalog has 3 entries, but 4 workers were requested/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('startTeam rejects explicit subagent assignments above MAX_WORKERS when workers is omitted', async () => {
    const tempRoot = createTempDir('omg-subagents-explicit-over-cap-');

    try {
      await seedSubagentWorkspace(tempRoot, 9);
      const backend = new SubagentsRuntimeBackend();

      await expect(
        withExperimentalFlagsCleared(() =>
          backend.startTeam({
            teamName: 'phase-c-subagents',
            task: 'explicit-over-cap',
            cwd: tempRoot,
            backend: 'subagents',
            subagents: [
              'planner',
              'executor',
              'verifier',
              'role-4',
              'role-5',
              'role-6',
              'role-7',
              'role-8',
              'role-9',
            ],
          }),
        ),
      ).rejects.toThrow(/expected integer 1\.\.8/i);
    } finally {
      removeDir(tempRoot);
    }
  });
});
