import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  cliEntrypointExists,
  createTempDir,
  removeDir,
  runOmp,
} from '../utils/runtime.js';

interface TeamRunJsonOutput {
  exitCode: number;
  message: string;
  details?: {
    backend?: string;
    phase?: string;
    subagents?: string[];
    phaseFilePath?: string;
  };
}

function parseJsonFromStdout(stdout: string): TeamRunJsonOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Expected JSON output but stdout was empty.');
  }

  try {
    return JSON.parse(trimmed) as TeamRunJsonOutput;
  } catch {
    const match = trimmed.match(/(\{[\s\S]*\})$/);
    const jsonFragment = match?.[1];
    if (!jsonFragment) {
      throw new Error(`Could not locate JSON in stdout:\n${stdout}`);
    }

    return JSON.parse(jsonFragment) as TeamRunJsonOutput;
  }
}

async function seedSubagentWorkspace(tempRoot: string): Promise<void> {
  const geminiDir = path.join(tempRoot, '.gemini');
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
    'utf8',
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
            aliases: ['plan'],
            mission: 'Create an execution plan.',
          },
          {
            id: 'executor',
            role: 'executor',
            aliases: ['execute'],
            mission: 'Apply deterministic implementation steps.',
          },
          {
            id: 'verifier',
            role: 'verifier',
            aliases: ['verify'],
            mission: 'Verify deterministic outcomes.',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
}

describe('integration: subagents team run flow', () => {
  test.runIf(cliEntrypointExists())(
    'team run with subagents backend completes and persists deterministic state',
    async () => {
      const tempRoot = createTempDir('omp-subagents-integration-');
      const teamName = 'integration-subagents';

      try {
        await seedSubagentWorkspace(tempRoot);

        const result = runOmp(
          [
            'team',
            'run',
            '--task',
            'integration-subagents-smoke',
            '--team',
            teamName,
            '--backend',
            'subagents',
            '--subagents',
            'planner,executor',
            '--max-fix-loop',
            '0',
            '--json',
          ],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);

        const output = parseJsonFromStdout(result.stdout);
        expect(output.exitCode).toBe(0);
        expect(output.details?.backend).toBe('subagents');
        expect(output.details?.phase).toBe('completed');
        expect(output.details?.subagents).toStrictEqual(['planner', 'executor']);

        const phaseFilePath = output.details?.phaseFilePath;
        expect(phaseFilePath).toBeDefined();
        expect(phaseFilePath).not.toBe('');

        const resolvedPhaseFilePath = phaseFilePath as string;
        expect(existsSync(resolvedPhaseFilePath)).toBe(true);

        const phaseState = JSON.parse(
          await fs.readFile(resolvedPhaseFilePath, 'utf8'),
        ) as {
          currentPhase?: string;
          transitions?: Array<{ to?: string }>;
        };

        expect(phaseState.currentPhase).toBe('completed');
        expect(
          (phaseState.transitions ?? []).some((transition) => transition.to === 'verify'),
        ).toBe(true);

        const snapshotPath = path.join(
          tempRoot,
          '.omp',
          'state',
          'team',
          teamName,
          'monitor-snapshot.json',
        );
        expect(existsSync(snapshotPath)).toBe(true);

        const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as {
          status?: string;
          workers?: Array<{ workerId?: string }>;
          summary?: string;
          runtime?: {
            verifyBaselinePassed?: boolean;
            roleOutputs?: Array<Record<string, unknown>>;
          };
        };

        expect(snapshot.status).toBe('completed');
        expect((snapshot.workers ?? []).map((worker) => worker.workerId)).toStrictEqual([
          'worker-1',
          'worker-2',
        ]);
        expect(snapshot.summary).toMatch(/planner, executor/i);
        expect(snapshot.runtime?.verifyBaselinePassed).toBe(true);

        const roleOutputs = snapshot.runtime?.roleOutputs ?? [];
        expect(roleOutputs).toHaveLength(2);
        for (const output of roleOutputs) {
          const artifacts = output.artifacts as { json?: string } | undefined;
          expect(typeof artifacts?.json).toBe('string');
          const artifactPath = path.join(tempRoot, artifacts?.json as string);
          expect(existsSync(artifactPath)).toBe(true);
        }
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.runIf(cliEntrypointExists())(
    'leading $ or / tags auto-select subagents backend and assignment',
    async () => {
      const tempRoot = createTempDir('omp-subagents-keyword-integration-');
      const teamName = 'integration-subagents-keywords';

      try {
        await seedSubagentWorkspace(tempRoot);

        const result = runOmp(
          [
            'team',
            'run',
            '--task',
            '$planner /executor keyword-assignment-smoke',
            '--team',
            teamName,
            '--max-fix-loop',
            '0',
            '--json',
          ],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        const output = parseJsonFromStdout(result.stdout);
        expect(output.exitCode).toBe(0);
        expect(output.details?.backend).toBe('subagents');
        expect(output.details?.phase).toBe('completed');
        expect(output.details?.subagents).toStrictEqual(['planner', 'executor']);
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.runIf(cliEntrypointExists())(
    'leading skill tags map to canonical role assignments during runtime resolution',
    async () => {
      const tempRoot = createTempDir('omp-subagents-skill-keyword-integration-');
      const teamName = 'integration-subagents-skill-keywords';

      try {
        await seedSubagentWorkspace(tempRoot);

        const result = runOmp(
          [
            'team',
            'run',
            '--task',
            '$plan /verify skill-assignment-smoke',
            '--team',
            teamName,
            '--max-fix-loop',
            '0',
            '--json',
          ],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        const output = parseJsonFromStdout(result.stdout);
        expect(output.exitCode).toBe(0);
        expect(output.details?.backend).toBe('subagents');
        expect(output.details?.subagents).toStrictEqual(['plan', 'verify']);

        const snapshotPath = path.join(
          tempRoot,
          '.omp',
          'state',
          'team',
          teamName,
          'monitor-snapshot.json',
        );
        expect(existsSync(snapshotPath)).toBe(true);

        const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as {
          summary?: string;
        };
        expect(snapshot.summary).toMatch(/planner, verifier/i);
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.runIf(cliEntrypointExists())(
    'alias tags resolve to canonical subagent assignments',
    async () => {
      const tempRoot = createTempDir('omp-subagents-alias-keyword-integration-');
      const teamName = 'integration-subagents-alias-keywords';

      try {
        await seedSubagentWorkspace(tempRoot);

        const result = runOmp(
          [
            'team',
            'run',
            '--task',
            '$plan /execute alias-keyword-assignment-smoke',
            '--team',
            teamName,
            '--max-fix-loop',
            '0',
            '--json',
          ],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              CI: '1',
            },
          },
        );

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        const output = parseJsonFromStdout(result.stdout);
        expect(output.exitCode).toBe(0);
        expect(output.details?.backend).toBe('subagents');
        expect(output.details?.phase).toBe('completed');
        expect(output.details?.subagents).toStrictEqual(['plan', 'execute']);

        const snapshotPath = path.join(
          tempRoot,
          '.omp',
          'state',
          'team',
          teamName,
          'monitor-snapshot.json',
        );
        const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as {
          summary?: string;
        };
        expect(snapshot.summary).toMatch(/planner, executor/i);
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.skipIf(cliEntrypointExists())(
    'subagents team-run integration is validated once CLI entrypoint exists',
    () => {
      expect(true).toBe(true);
    },
  );
});
