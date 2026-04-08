import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { evaluateRoleOutputContract } from '../../src/team/role-output-contract.js';
import type { TeamSnapshot } from '../../src/team/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function createSnapshot(runtime?: Record<string, unknown>): TeamSnapshot {
  return {
    handleId: 'handle-1',
    teamName: 'role-contract-test',
    backend: 'subagents',
    status: 'completed',
    updatedAt: new Date('2026-03-02T00:00:00.000Z').toISOString(),
    workers: [],
    runtime,
  };
}

describe('reliability: role output contract', () => {
  test('passes when planner/executor/verifier outputs satisfy schema', () => {
    const snapshot = createSnapshot({
      selectedSubagents: [
        { id: 'planner', role: 'planner', workerId: 'worker-1', skills: ['plan'] },
        { id: 'executor', role: 'executor', workerId: 'worker-2', skills: ['team'] },
        { id: 'verifier', role: 'verifier', workerId: 'worker-3', skills: ['verify'] },
      ],
      roleOutputs: [
        {
          subagentId: 'planner',
          roleId: 'planner',
          workerId: 'worker-1',
          status: 'completed',
          summary: 'planner summary',
          artifacts: { json: 'virtual://planner.json' },
          plan: { steps: ['step-1'] },
        },
        {
          subagentId: 'executor',
          roleId: 'executor',
          workerId: 'worker-2',
          status: 'completed',
          summary: 'executor summary',
          artifacts: { json: 'virtual://executor.json' },
          implementation: {
            changeSummary: 'implemented changes',
            commands: ['npm run typecheck'],
          },
        },
        {
          subagentId: 'verifier',
          roleId: 'verifier',
          workerId: 'worker-3',
          status: 'completed',
          summary: 'verifier summary',
          artifacts: { json: 'virtual://verifier.json' },
          verification: [
            {
              name: 'typecheck',
              result: 'PASS',
              command: 'npm run typecheck',
            },
          ],
        },
      ],
    });

    const report = evaluateRoleOutputContract(snapshot);

    expect(report.applicable).toBe(true);
    expect(report.passed).toBe(true);
    expect(report.issues).toStrictEqual([]);
  });

  test('fails when required role-specific outputs are missing', () => {
    const snapshot = createSnapshot({
      selectedSubagents: [
        { id: 'verifier', role: 'verifier', workerId: 'worker-1', skills: ['verify'] },
      ],
      roleOutputs: [
        {
          subagentId: 'verifier',
          roleId: 'verifier',
          workerId: 'worker-1',
          status: 'completed',
          summary: 'verifier summary',
          artifacts: { json: 'virtual://verifier.json' },
          verification: [],
        },
      ],
    });

    const report = evaluateRoleOutputContract(snapshot);

    expect(report.applicable).toBe(true);
    expect(report.passed).toBe(false);
    expect(report.summary).toMatch(/failed/i);
    expect(report.issues.join('\n')).toMatch(/missing verification checks/i);
  });

  test('fails when verifier evidence contains non-pass result', () => {
    const snapshot = createSnapshot({
      selectedSubagents: [
        { id: 'verifier', role: 'verifier', workerId: 'worker-1', skills: ['verify'] },
      ],
      roleOutputs: [
        {
          subagentId: 'verifier',
          roleId: 'verifier',
          workerId: 'worker-1',
          status: 'completed',
          summary: 'verifier summary',
          artifacts: { json: 'virtual://verifier.json' },
          verification: [
            {
              name: 'typecheck',
              result: 'FAIL',
              command: 'npm run typecheck',
            },
          ],
        },
      ],
    });

    const report = evaluateRoleOutputContract(snapshot);
    expect(report.passed).toBe(false);
    expect(report.issues.join('\n')).toMatch(/non-pass verification result/i);
  });

  test('fails when handoff output is missing handoff.notes', () => {
    const snapshot = createSnapshot({
      selectedSubagents: [
        { id: 'writer', role: 'writer', workerId: 'worker-1', skills: ['handoff'] },
      ],
      roleOutputs: [
        {
          subagentId: 'writer',
          roleId: 'writer',
          workerId: 'worker-1',
          status: 'completed',
          summary: 'writer summary',
          artifacts: { json: 'virtual://writer.json' },
          handoff: {
            audience: 'team-lead',
          },
        },
      ],
    });

    const report = evaluateRoleOutputContract(snapshot);
    expect(report.passed).toBe(false);
    expect(report.issues.join('\n')).toMatch(/handoff\.notes/i);
  });

  test('fails when artifact evidence file is missing under deterministic root', async () => {
    const tempRoot = createTempDir('omp-role-contract-evidence-');

    try {
      const snapshot = createSnapshot({
        selectedSubagents: [
          { id: 'planner', role: 'planner', workerId: 'worker-1', skills: ['plan'] },
        ],
        roleOutputs: [
          {
            subagentId: 'planner',
            roleId: 'planner',
            workerId: 'worker-1',
            status: 'completed',
            summary: 'planner summary',
            artifacts: {
              json: '.omp/state/team/role-contract-test/artifacts/roles/worker-1/planner.json',
            },
            plan: {
              steps: ['step-1'],
            },
          },
        ],
      });

      const reportMissing = evaluateRoleOutputContract(snapshot, {
        requireArtifactEvidence: true,
        cwd: tempRoot,
        teamName: 'role-contract-test',
      });
      expect(reportMissing.passed).toBe(false);
      expect(reportMissing.issues.join('\n')).toMatch(/artifact file is missing/i);

      const artifactPath = path.join(
        tempRoot,
        '.omp',
        'state',
        'team',
        'role-contract-test',
        'artifacts',
        'roles',
        'worker-1',
        'planner.json',
      );
      await fs.mkdir(path.dirname(artifactPath), { recursive: true });
      await fs.writeFile(artifactPath, '{"ok":true}\n', 'utf8');

      const reportPresent = evaluateRoleOutputContract(snapshot, {
        requireArtifactEvidence: true,
        cwd: tempRoot,
        teamName: 'role-contract-test',
      });
      expect(reportPresent.passed).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('is not applicable when no selected subagent assignments exist', () => {
    const report = evaluateRoleOutputContract(
      createSnapshot({
        roleOutputs: [],
      }),
    );

    expect(report.applicable).toBe(false);
    expect(report.passed).toBe(true);
  });
});
