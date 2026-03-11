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
          const idByIndex = [
            'planner',
            'executor',
            'verifier',
            'code-reviewer',
            'writer',
          ] as const;
          const id = idByIndex[index] ?? `role-${index + 1}`;
          const aliasesById: Record<string, string[] | undefined> = {
            planner: ['plan'],
            executor: ['execute'],
            verifier: ['verify'],
            'code-reviewer': ['review'],
            writer: ['handoff'],
          };

          return {
            id,
            role: id,
            mission: `Execute responsibilities for ${id}.`,
            aliases: aliasesById[id],
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

      expect((handle.runtime as { taskAuditLogPath?: string }).taskAuditLogPath).toMatch(
        /events\/task-lifecycle\.ndjson$/,
      );

      const snapshot = await backend.monitorTeam(handle);

      expect(snapshot.status).toBe('completed');
      expect(snapshot.workers.map((worker) => worker.workerId)).toStrictEqual([
        'worker-1',
        'worker-2',
      ]);
      expect(snapshot.summary).toMatch(/planner, executor/i);
      const workerById = new Map(
        snapshot.workers.map((worker) => [worker.workerId, worker.details ?? '']),
      );
      expect(workerById.get('worker-1')).toContain('model=gemini-3-pro');
      expect(workerById.get('worker-2')).toContain('model=gemini-3-flash');
      expect(workerById.get('worker-1')).toContain('stage=1');
      expect(workerById.get('worker-2')).toContain('stage=2');
      expect(workerById.get('worker-2')).toContain('dependsOn=worker-1');
      expect(
        snapshot.workers.every((worker) =>
          (worker.details ?? '').includes('skill='),
        ),
      ).toBe(true);

      const runtime = (snapshot.runtime ?? {}) as Record<string, unknown>;
      expect(runtime.verifyBaselinePassed).toBe(true);
      expect(runtime.roleManagementVersion).toBe(1);
      const roleManagement = runtime.roleManagement as
        | {
            source?: string;
            resolvedRoles?: Array<{
              subagentId?: string;
              modelTier?: string;
              recommendedGeminiModel?: string;
            }>;
          }
        | undefined;
      expect(roleManagement?.source).toBe('omc-port');
      const resolvedRoles = Array.isArray(roleManagement?.resolvedRoles)
        ? roleManagement.resolvedRoles
        : [];
      expect(
        resolvedRoles.find((entry) => entry.subagentId === 'planner')
          ?.recommendedGeminiModel,
      ).toBe('gemini-3-pro');
      expect(
        resolvedRoles.find((entry) => entry.subagentId === 'executor')
          ?.recommendedGeminiModel,
      ).toBe('gemini-3-flash');
      expect(runtime.coordinationVersion).toBe(1);
      const coordinationPlan = runtime.coordinationPlan as
        | {
            strategy?: string;
            steps?: Array<{
              stage?: number;
              workerIds?: string[];
            }>;
            handoffs?: Array<{
              from?: string;
              to?: string;
              reason?: string;
            }>;
          }
        | undefined;
      expect(coordinationPlan?.strategy).toBe('omc-role-aware');
      expect(coordinationPlan?.steps?.[0]?.workerIds).toStrictEqual(['worker-1']);
      expect(coordinationPlan?.steps?.[1]?.workerIds).toStrictEqual(['worker-2']);
      expect(coordinationPlan?.handoffs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from: 'worker-1',
            to: 'worker-2',
          }),
        ]),
      );
      expect(runtime.agentLifecycleVersion).toBe(1);
      const agentLifecycle = Array.isArray(runtime.agentLifecycle)
        ? runtime.agentLifecycle
        : [];
      expect(agentLifecycle).toHaveLength(2);
      expect(
        agentLifecycle.every((entry) => {
          if (typeof entry !== 'object' || entry === null) {
            return false;
          }
          return (entry as Record<string, unknown>).status === 'completed';
        }),
      ).toBe(true);
      const roleOutputs = Array.isArray(runtime.roleOutputs)
        ? runtime.roleOutputs
        : [];
      expect(roleOutputs).toHaveLength(2);
      expect(
        roleOutputs.every((entry) => {
          if (typeof entry !== 'object' || entry === null) {
            return false;
          }
          const artifacts = (entry as Record<string, unknown>).artifacts;
          return (
            typeof artifacts === 'object' &&
            artifacts !== null &&
            typeof (artifacts as Record<string, unknown>).json === 'string'
          );
        }),
      ).toBe(true);
      expect(
        roleOutputs.every((entry) => {
          if (typeof entry !== 'object' || entry === null) {
            return false;
          }
          const artifacts = (entry as Record<string, unknown>).artifacts;
          const jsonRef =
            typeof artifacts === 'object' && artifacts !== null
              ? (artifacts as Record<string, unknown>).json
              : undefined;
          if (typeof jsonRef !== 'string') {
            return false;
          }
          return jsonRef.includes('.omg/state/team/phase-c-subagents/artifacts/roles/');
        }),
      ).toBe(true);

      const plannerOutput = roleOutputs.find(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as Record<string, unknown>).subagentId === 'planner',
      ) as Record<string, unknown> | undefined;
      const executorOutput = roleOutputs.find(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as Record<string, unknown>).subagentId === 'executor',
      ) as Record<string, unknown> | undefined;

      expect(Array.isArray((plannerOutput?.plan as { steps?: unknown } | undefined)?.steps)).toBe(
        true,
      );
      expect(
        Array.isArray(
          (executorOutput?.implementation as { commands?: unknown } | undefined)?.commands,
        ),
      ).toBe(true);

      const roleContract = runtime.roleContract as
        | { version?: number; outputCount?: number; assignmentCount?: number }
        | undefined;
      expect(roleContract?.version).toBe(1);
      expect(roleContract?.outputCount).toBe(2);
      expect(roleContract?.assignmentCount).toBe(2);

      expect(
        JSON.stringify(handle.runtime),
      ).toMatch(/selectedSubagents|catalogPath|unifiedModel/);

      const plannerArtifacts = plannerOutput?.artifacts as
        | { json?: string; markdown?: string }
        | undefined;
      const executorArtifacts = executorOutput?.artifacts as
        | { json?: string; markdown?: string }
        | undefined;

      for (const artifactRef of [
        plannerArtifacts?.json,
        plannerArtifacts?.markdown,
        executorArtifacts?.json,
        executorArtifacts?.markdown,
      ]) {
        expect(typeof artifactRef).toBe('string');
        const artifactPath = path.join(tempRoot, artifactRef as string);
        const artifactContent = await fs.readFile(artifactPath, 'utf8');
        expect(artifactContent.trim()).not.toBe('');
      }

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

  test('startTeam fails when catalog declares unknown canonical skill ids', async () => {
    const tempRoot = createTempDir('omg-subagents-unknown-skill-');

    try {
      await seedSubagentWorkspace(tempRoot, 2);
      const catalogPath = path.join(tempRoot, '.gemini', 'agents', 'catalog.json');
      const rawCatalog = JSON.parse(
        await fs.readFile(catalogPath, 'utf8'),
      ) as { subagents?: Array<Record<string, unknown>> };
      if (!Array.isArray(rawCatalog.subagents) || rawCatalog.subagents.length === 0) {
        throw new Error('seeded catalog did not include subagents');
      }

      rawCatalog.subagents[0] = {
        ...(rawCatalog.subagents[0] ?? {}),
        skills: ['nonexistent-skill'],
      };
      await fs.writeFile(catalogPath, `${JSON.stringify(rawCatalog, null, 2)}\n`, 'utf8');

      const backend = new SubagentsRuntimeBackend();
      await expect(
        withExperimentalFlagsCleared(() =>
          backend.startTeam({
            teamName: 'phase-c-subagents',
            task: 'invalid-skill-catalog',
            cwd: tempRoot,
            backend: 'subagents',
            workers: 2,
          }),
        ),
      ).rejects.toThrow(/unknown skill id\(s\)/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('startTeam resolves canonical skill aliases to catalog role ids', async () => {
    const tempRoot = createTempDir('omg-subagents-skill-aliases-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'skill-alias-selection',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['plan', 'verify'],
        }),
      );

      const snapshot = await backend.monitorTeam(handle);
      expect(snapshot.status).toBe('completed');
      expect(snapshot.summary).toMatch(/planner, verifier/i);
      expect(
        snapshot.workers.every((worker) =>
          (worker.details ?? '').includes('skill='),
        ),
      ).toBe(true);
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

  test('startTeam resolves aliases and deduplicates canonical role selection', async () => {
    const tempRoot = createTempDir('omg-subagents-alias-selection-');

    try {
      await seedSubagentWorkspace(tempRoot, 4);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'alias-selection',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['review', 'code-reviewer', 'plan'],
        }),
      );

      const snapshot = await backend.monitorTeam(handle);
      expect(snapshot.status).toBe('completed');
      expect(snapshot.summary).toMatch(/code-reviewer, planner/i);

      const runtimeSelected = (
        handle.runtime.selectedSubagents as
          | Array<{ id?: string; aliases?: string[] }>
          | undefined
      ) ?? [];
      expect(runtimeSelected.map((entry) => entry.id)).toStrictEqual([
        'code-reviewer',
        'planner',
      ]);
      expect(runtimeSelected[0]?.aliases).toContain('review');
      expect(runtimeSelected[1]?.aliases).toContain('plan');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('monitorTeam refuses to synthesize completion when persisted role outputs are missing', async () => {
    const tempRoot = createTempDir('omg-subagents-missing-role-outputs-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'missing-role-outputs',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['planner', 'executor'],
        }),
      );

      const degradedHandle = {
        ...handle,
        runtime: {
          ...handle.runtime,
          roleOutputs: undefined,
        },
      };

      const restoredBackend = new SubagentsRuntimeBackend();
      const snapshot = await restoredBackend.monitorTeam(degradedHandle);
      const runtime = (snapshot.runtime ?? {}) as Record<string, unknown>;
      const truthfulnessGuard = runtime.truthfulnessGuard as
        | { synthesizedCompletionBlocked?: boolean; reason?: string }
        | undefined;

      expect(snapshot.status).toBe('failed');
      expect(snapshot.failureReason).toMatch(/evidence gate|truthfulness guard/i);
      expect(truthfulnessGuard?.synthesizedCompletionBlocked).toBe(true);
      expect(String(truthfulnessGuard?.reason ?? '')).toMatch(/missing persisted role outputs/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('monitorTeam fails verify baseline when referenced artifact evidence is missing', async () => {
    const tempRoot = createTempDir('omg-subagents-missing-artifact-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'artifact-evidence-missing',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['planner', 'executor'],
        }),
      );

      const roleOutputs = (handle.runtime.roleOutputs as Array<Record<string, unknown>> | undefined) ?? [];
      const plannerOutput = roleOutputs.find((entry) => entry.subagentId === 'planner');
      const plannerArtifacts = plannerOutput?.artifacts as
        | { json?: string }
        | undefined;
      const plannerJsonRef = plannerArtifacts?.json;
      expect(typeof plannerJsonRef).toBe('string');
      await fs.unlink(path.join(tempRoot, plannerJsonRef as string));

      const snapshot = await backend.monitorTeam(handle);
      const runtime = (snapshot.runtime ?? {}) as Record<string, unknown>;

      expect(snapshot.status).toBe('failed');
      expect(snapshot.failureReason).toMatch(/artifact/i);
      expect(runtime.verifyBaselinePassed).toBe(false);
      expect(String(runtime.verifyBaselineSource ?? '')).toMatch(/contract/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('monitorTeam reflects failed role output status as failed worker and snapshot failure', async () => {
    const tempRoot = createTempDir('omg-subagents-failed-role-output-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'failed-role-output',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['planner', 'executor'],
        }),
      );

      const roleOutputs = (handle.runtime.roleOutputs as Array<Record<string, unknown>> | undefined) ?? [];
      const plannerOutput = roleOutputs.find((entry) => entry.subagentId === 'planner');
      if (!plannerOutput) {
        throw new Error('planner output was not generated');
      }
      plannerOutput.status = 'failed';
      plannerOutput.summary = 'planner failed';

      const snapshot = await backend.monitorTeam(handle);
      const runtime = (snapshot.runtime ?? {}) as Record<string, unknown>;

      expect(snapshot.status).toBe('failed');
      expect(snapshot.workers.find((worker) => worker.workerId === 'worker-1')?.status).toBe('failed');
      expect(runtime.verifyBaselinePassed).toBe(false);
      expect(snapshot.summary).toMatch(/evidence gate failed/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('startTeam rejects explicit subagent assignments above MAX_WORKERS when workers is omitted', async () => {
    const tempRoot = createTempDir('omg-subagents-explicit-over-cap-');

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'settings.json'),
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
      const backend = new SubagentsRuntimeBackend();

      await expect(
        withExperimentalFlagsCleared(() =>
          backend.startTeam({
            teamName: 'phase-c-subagents',
            task: 'explicit-over-cap',
            cwd: tempRoot,
            backend: 'subagents',
            subagents: [
              'analyst',
              'architect',
              'build-fixer',
              'code-reviewer',
              'code-simplifier',
              'critic',
              'debugger',
              'deep-executor',
              'designer',
            ],
          }),
        ),
      ).rejects.toThrow(/expected integer 1\.\.8/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('monitorTeam refuses false completion synthesis when role outputs are non-terminal', async () => {
    const tempRoot = createTempDir('omg-subagents-truthfulness-');

    try {
      await seedSubagentWorkspace(tempRoot);
      const backend = new SubagentsRuntimeBackend();

      const handle = await withExperimentalFlagsCleared(() =>
        backend.startTeam({
          teamName: 'phase-c-subagents',
          task: 'truthfulness-guard',
          cwd: tempRoot,
          backend: 'subagents',
          subagents: ['planner', 'executor'],
        }),
      );

      await backend.shutdownTeam(handle);
      const runtime = handle.runtime as { roleOutputs?: Array<Record<string, unknown>> };
      if (!Array.isArray(runtime.roleOutputs) || runtime.roleOutputs.length === 0) {
        throw new Error('expected role outputs in handle runtime');
      }
      runtime.roleOutputs[0] = {
        ...runtime.roleOutputs[0],
        status: 'running',
      };

      const snapshot = await backend.monitorTeam(handle);
      expect(snapshot.status).toBe('failed');
      expect(snapshot.summary).toMatch(/truthfulness guard|evidence gate/i);
      expect((snapshot.runtime as Record<string, unknown>).verifyBaselinePassed).toBe(false);
    } finally {
      removeDir(tempRoot);
    }
  });
});
