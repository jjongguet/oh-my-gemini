import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/team-state-store.js';
import { TeamOrchestrator } from '../../src/team/team-orchestrator.js';
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
            mission: 'Draft the work plan.',
          },
          {
            id: 'executor',
            role: 'executor',
            mission: 'Implement code changes.',
          },
        ],
      },
      null,
      2,
    ),
  );
}

describe('reliability: orchestrator with subagents backend', () => {
  test('run succeeds with explicit subagent assignment', async () => {
    const tempRoot = createTempDir('omg-orchestrator-subagents-');

    try {
      await seedSubagentWorkspace(tempRoot);

      const teamName = 'subagents-success';
      const stateStore = new TeamStateStore({
        rootDir: path.join(tempRoot, '.omg', 'state'),
      });
      const orchestrator = new TeamOrchestrator({
        stateStore,
        treatRunningAsSuccess: false,
      });

      const result = await withExperimentalFlagsCleared(() =>
        orchestrator.run({
          teamName,
          task: 'phase-c explicit assignments',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['planner', 'executor'],
          maxFixAttempts: 0,
        }),
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe('completed');
      expect(result.backend).toBe('subagents');
      expect(result.snapshot?.workers.map((worker) => worker.workerId)).toStrictEqual([
        'worker-1',
        'worker-2',
      ]);

      const phaseState = await stateStore.readPhaseState(teamName);
      expect(phaseState?.currentPhase).toBe('completed');

      if (result.handle) {
        await orchestrator.shutdown(result.handle, true);
      }
    } finally {
      removeDir(tempRoot);
    }
  });
});
