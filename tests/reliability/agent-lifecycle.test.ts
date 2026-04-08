import { describe, expect, test } from 'vitest';

import {
  buildAgentLifecycleRecords,
  buildInitialAgentLifecycleRecords,
  deriveAgentLifecycleStatus,
  summarizeAgentLifecycle,
} from '../../src/team/agent-lifecycle.js';
import type { TeamSubagentDefinition } from '../../src/team/types.js';

function createSubagents(): TeamSubagentDefinition[] {
  return [
    {
      id: 'planner',
      role: 'planner',
      mission: 'Plan the work.',
      model: 'gemini-2.5-pro',
    },
    {
      id: 'executor',
      role: 'executor',
      mission: 'Implement the work.',
      model: 'gemini-2.5-pro',
    },
  ];
}

describe('reliability: agent lifecycle', () => {
  test('derives lifecycle statuses from role outputs', () => {
    expect(deriveAgentLifecycleStatus('completed')).toBe('completed');
    expect(deriveAgentLifecycleStatus('in_progress')).toBe('running');
    expect(deriveAgentLifecycleStatus('blocked')).toBe('blocked');
    expect(deriveAgentLifecycleStatus('failed')).toBe('failed');
    expect(deriveAgentLifecycleStatus(undefined)).toBe('unknown');
  });

  test('buildInitialAgentLifecycleRecords marks selected subagents as running', () => {
    const records = buildInitialAgentLifecycleRecords({
      selectedSubagents: createSubagents(),
      startedAt: '2026-03-05T08:00:00.000Z',
    });

    expect(records.map((entry) => entry.workerId)).toStrictEqual([
      'worker-1',
      'worker-2',
    ]);
    expect(records.every((entry) => entry.status === 'running')).toBe(true);
    expect(records.every((entry) => entry.startedAt === '2026-03-05T08:00:00.000Z')).toBe(
      true,
    );
  });

  test('buildAgentLifecycleRecords summarizes completion from role outputs', () => {
    const records = buildAgentLifecycleRecords({
      selectedSubagents: createSubagents(),
      roleOutputs: [
        {
          workerId: 'worker-1',
          status: 'completed',
          summary: 'planner complete',
          artifacts: {
            json: '.omp/state/team/t1/artifacts/roles/worker-1/planner.json',
          },
        },
        {
          workerId: 'worker-2',
          status: 'failed',
          summary: 'executor failed',
          artifacts: {
            markdown: '.omp/state/team/t1/artifacts/roles/worker-2/executor.md',
          },
        },
      ],
      observedAt: '2026-03-05T08:02:00.000Z',
      startedAtByWorkerId: {
        'worker-1': '2026-03-05T08:00:00.000Z',
        'worker-2': '2026-03-05T08:00:00.000Z',
      },
    });

    expect(records).toHaveLength(2);
    expect(records[0]?.status).toBe('completed');
    expect(records[1]?.status).toBe('failed');
    expect(records[0]?.completedAt).toBe('2026-03-05T08:02:00.000Z');
    expect(records[1]?.completedAt).toBe('2026-03-05T08:02:00.000Z');

    const summary = summarizeAgentLifecycle(records);
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.nonTerminal).toBe(0);
    expect(summary.terminal).toBe(true);
  });
});
