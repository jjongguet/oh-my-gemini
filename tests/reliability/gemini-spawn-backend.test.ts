import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { describe, expect, test, vi } from 'vitest';

import { GeminiSpawnBackend } from '../../src/team/runtime/gemini-spawn-backend.js';
import { TeamStateStore } from '../../src/state/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function createFakeChildProcess(pid: number) {
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: PassThrough;
    stderr: PassThrough;
    kill: () => boolean;
  };
  child.pid = pid;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  return child;
}

async function seedCatalog(rootDir: string): Promise<void> {
  const agentsDir = path.join(rootDir, '.gemini', 'agents');
  await fs.mkdir(agentsDir, { recursive: true });
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
            mission: 'Plan the requested work.',
            aliases: ['plan'],
            skills: ['plan'],
            model: 'gemini-2.5-pro',
          },
          {
            id: 'executor',
            role: 'executor',
            mission: 'Implement the requested work.',
            aliases: ['execute'],
            skills: ['team'],
            model: 'gemini-2.5-pro',
          },
        ],
      },
      null,
      2,
    ),
  );
}

async function writeRoleArtifact(params: {
  rootDir: string;
  teamName: string;
  workerName: string;
  stateStore: TeamStateStore;
  summary: string;
  kind: 'plan' | 'team';
}): Promise<Record<string, unknown>> {
  const identity = await params.stateStore.readWorkerIdentity(params.teamName, params.workerName);
  const metadata =
    identity && typeof identity.metadata === 'object' && identity.metadata !== null
      ? identity.metadata
      : {};
  const roleArtifactBase =
    typeof metadata.roleArtifactBase === 'string'
      ? metadata.roleArtifactBase
      : `.omp/state/team/${params.teamName}/artifacts/roles/${params.workerName}/${params.workerName}`;
  const subagentId =
    typeof metadata.subagentId === 'string' ? metadata.subagentId : params.workerName;
  const roleId =
    typeof identity?.role === 'string' ? identity.role : params.workerName;

  const roleOutput: Record<string, unknown> = {
    subagentId,
    roleId,
    workerId: params.workerName,
    skill: params.kind === 'plan' ? 'plan' : 'team',
    skills: [params.kind === 'plan' ? 'plan' : 'team'],
    status: 'completed',
    summary: params.summary,
    completionProvenance: 'gemini-spawn',
    artifacts: {
      json: `${roleArtifactBase}.json`,
      markdown: `${roleArtifactBase}.md`,
    },
  };

  if (params.kind === 'plan') {
    roleOutput.plan = {
      objective: 'Ship the headless backend',
      steps: ['Define evidence contract', 'Add backend runtime'],
    };
  } else {
    roleOutput.implementation = {
      changeSummary: 'Implemented the gemini-spawn backend.',
      commands: ['npm run typecheck'],
    };
  }

  const jsonPath = path.join(params.rootDir, `${roleArtifactBase}.json`);
  const markdownPath = path.join(params.rootDir, `${roleArtifactBase}.md`);
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(roleOutput, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, `# ${roleId}\n\n${params.summary}\n`, 'utf8');

  return roleOutput;
}

describe('reliability: gemini-spawn backend', () => {
  test('probePrerequisites fails with actionable issue when Gemini CLI is unavailable', async () => {
    const backend = new GeminiSpawnBackend({
      commandRunner: async () => {
        throw new Error('spawn gemini ENOENT');
      },
    });

    const probe = await backend.probePrerequisites(process.cwd());

    expect(probe.ok).toBe(false);
    expect(probe.issues.join('\n')).toMatch(/Gemini CLI is unavailable/i);
  });

  test('startTeam + monitorTeam completes when done signals and artifact evidence exist', async () => {
    const tempRoot = createTempDir('omp-gemini-spawn-success-');
    let nextPid = 12000;

    try {
      await seedCatalog(tempRoot);
      const backend = new GeminiSpawnBackend({
        commandRunner: async () => ({ code: 0, stdout: 'gemini 1.0.0', stderr: '' }),
        spawnProcess: () => createFakeChildProcess(nextPid++) as never,
      });
      const stateStore = new TeamStateStore({ cwd: tempRoot });

      const handle = await backend.startTeam({
        teamName: 'gemini-spawn-team',
        task: 'implement real headless backend',
        cwd: tempRoot,
        backend: 'gemini-spawn',
        subagents: ['planner', 'executor'],
      });

      const plannerOutput = await writeRoleArtifact({
        rootDir: tempRoot,
        teamName: 'gemini-spawn-team',
        workerName: 'worker-1',
        stateStore,
        summary: 'Planned the rollout.',
        kind: 'plan',
      });
      const executorOutput = await writeRoleArtifact({
        rootDir: tempRoot,
        teamName: 'gemini-spawn-team',
        workerName: 'worker-2',
        stateStore,
        summary: 'Implemented the backend.',
        kind: 'team',
      });

      await stateStore.writeWorkerDone({
        teamName: 'gemini-spawn-team',
        workerName: 'worker-1',
        status: 'completed',
        completedAt: new Date().toISOString(),
        summary: 'Planned the rollout.',
        metadata: {
          roleOutput: plannerOutput,
        },
      });
      await stateStore.writeWorkerDone({
        teamName: 'gemini-spawn-team',
        workerName: 'worker-2',
        status: 'completed',
        completedAt: new Date().toISOString(),
        summary: 'Implemented the backend.',
        metadata: {
          roleOutput: executorOutput,
        },
      });
      await stateStore.writeWorkerHeartbeat({
        teamName: 'gemini-spawn-team',
        workerName: 'worker-1',
        alive: false,
        pid: 12000,
        updatedAt: new Date().toISOString(),
      });
      await stateStore.writeWorkerHeartbeat({
        teamName: 'gemini-spawn-team',
        workerName: 'worker-2',
        alive: false,
        pid: 12001,
        updatedAt: new Date().toISOString(),
      });
      await stateStore.writeWorkerStatus('gemini-spawn-team', 'worker-1', {
        state: 'idle',
        updatedAt: new Date().toISOString(),
      });
      await stateStore.writeWorkerStatus('gemini-spawn-team', 'worker-2', {
        state: 'idle',
        updatedAt: new Date().toISOString(),
      });

      const snapshot = await backend.monitorTeam(handle);
      const runtime = snapshot.runtime ?? {};

      expect(snapshot.status).toBe('completed');
      expect(snapshot.workers.map((worker) => worker.status)).toStrictEqual(['done', 'done']);
      expect(runtime.verifyBaselinePassed).toBe(true);
      expect(runtime.prd).toBeUndefined();
      expect(Array.isArray(runtime.roleOutputs)).toBe(true);
      expect((runtime.roleOutputs as unknown[])).toHaveLength(2);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('monitorTeam fails when role artifact files are missing', async () => {
    const tempRoot = createTempDir('omp-gemini-spawn-missing-artifacts-');
    let nextPid = 13000;

    try {
      await seedCatalog(tempRoot);
      const backend = new GeminiSpawnBackend({
        commandRunner: async () => ({ code: 0, stdout: 'gemini 1.0.0', stderr: '' }),
        spawnProcess: () => createFakeChildProcess(nextPid++) as never,
      });
      const stateStore = new TeamStateStore({ cwd: tempRoot });

      const handle = await backend.startTeam({
        teamName: 'gemini-spawn-missing-artifacts',
        task: 'implement real headless backend',
        cwd: tempRoot,
        backend: 'gemini-spawn',
        subagents: ['planner'],
      });

      const identity = await stateStore.readWorkerIdentity(
        'gemini-spawn-missing-artifacts',
        'worker-1',
      );
      const metadata =
        identity && typeof identity.metadata === 'object' && identity.metadata !== null
          ? identity.metadata
          : {};
      const roleArtifactBase =
        typeof metadata.roleArtifactBase === 'string'
          ? metadata.roleArtifactBase
          : '.omp/state/team/gemini-spawn-missing-artifacts/artifacts/roles/worker-1/planner';
      const roleOutput = {
        subagentId: 'planner',
        roleId: 'planner',
        workerId: 'worker-1',
        skill: 'plan',
        skills: ['plan'],
        status: 'completed',
        summary: 'Planned the rollout.',
        completionProvenance: 'gemini-spawn',
        artifacts: {
          json: `${roleArtifactBase}.json`,
          markdown: `${roleArtifactBase}.md`,
        },
        plan: {
          objective: 'Ship the backend',
          steps: ['Define the evidence contract'],
        },
      };

      await stateStore.writeWorkerDone({
        teamName: 'gemini-spawn-missing-artifacts',
        workerName: 'worker-1',
        status: 'completed',
        completedAt: new Date().toISOString(),
        summary: 'Planned the rollout.',
        metadata: {
          roleOutput,
        },
      });
      await stateStore.writeWorkerHeartbeat({
        teamName: 'gemini-spawn-missing-artifacts',
        workerName: 'worker-1',
        alive: false,
        pid: 13000,
        updatedAt: new Date().toISOString(),
      });
      await stateStore.writeWorkerStatus('gemini-spawn-missing-artifacts', 'worker-1', {
        state: 'idle',
        updatedAt: new Date().toISOString(),
      });

      const snapshot = await backend.monitorTeam(handle);
      const runtime = snapshot.runtime ?? {};

      expect(snapshot.status).toBe('failed');
      expect(runtime.verifyBaselinePassed).toBe(false);
      expect(snapshot.failureReason ?? snapshot.summary).toMatch(/role output contract failed/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('shutdownTeam supplements worker process metadata from persisted state', async () => {
    const tempRoot = createTempDir('omp-gemini-spawn-shutdown-state-');
    const stateStore = new TeamStateStore({ cwd: tempRoot });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((() => true) as typeof process.kill);

    try {
      await stateStore.writeWorkerIdentity({
        teamName: 'gemini-spawn-shutdown-team',
        workerName: 'worker-1',
        role: 'planner',
        updatedAt: new Date().toISOString(),
        metadata: {
          subagentId: 'planner',
          wrapperPid: 31000,
          childPid: 31001,
          signalForwardingMode: 'wrapper-forward',
        },
      });

      const backend = new GeminiSpawnBackend();
      await backend.shutdownTeam({
        id: 'gemini-spawn-shutdown-handle',
        teamName: 'gemini-spawn-shutdown-team',
        backend: 'gemini-spawn',
        cwd: tempRoot,
        startedAt: new Date().toISOString(),
        runtime: {
          stateRoot: path.join(tempRoot, '.omp', 'state'),
        },
      }, {
        force: true,
      });

      expect(killSpy).toHaveBeenCalledWith(31000, 0);
      expect(killSpy).toHaveBeenCalledWith(31000, 'SIGTERM');
      expect(killSpy).toHaveBeenCalledWith(31001, 'SIGKILL');
    } finally {
      killSpy.mockRestore();
      removeDir(tempRoot);
    }
  });
});
