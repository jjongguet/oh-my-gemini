import { describe, expect, test } from 'vitest';

import { createAgentCoordinationPlan } from '../../src/team/agent-coordination.js';
import type { TeamSubagentDefinition } from '../../src/team/types.js';

function makeSubagent(
  id: string,
  aliases: string[] = [],
): TeamSubagentDefinition {
  return {
    id,
    role: id,
    mission: `Mission for ${id}`,
    model: 'gemini-2.5-pro',
    aliases,
  };
}

describe('reliability: agent coordination plan', () => {
  test('creates stage handoff plan for planner -> executor -> verifier flow', () => {
    const plan = createAgentCoordinationPlan([
      makeSubagent('planner', ['plan']),
      makeSubagent('executor', ['execute']),
      makeSubagent('verifier', ['verify']),
    ]);

    expect(plan.strategy).toBe('omc-role-aware');
    expect(plan.steps).toHaveLength(3);

    expect(plan.steps[0]).toMatchObject({
      stage: 1,
      workerIds: ['worker-1'],
      agentIds: ['planner'],
      dependsOn: [],
    });

    expect(plan.steps[1]).toMatchObject({
      stage: 2,
      workerIds: ['worker-2'],
      agentIds: ['executor'],
      dependsOn: ['worker-1'],
    });

    expect(plan.steps[2]).toMatchObject({
      stage: 3,
      workerIds: ['worker-3'],
      agentIds: ['verifier'],
      dependsOn: ['worker-2'],
    });

    expect(plan.handoffs).toStrictEqual([
      {
        from: 'worker-1',
        to: 'worker-2',
        reason: 'stage-1-to-stage-2',
      },
      {
        from: 'worker-2',
        to: 'worker-3',
        reason: 'stage-2-to-stage-3',
      },
    ]);
  });

  test('groups planning roles together and fans out handoffs', () => {
    const plan = createAgentCoordinationPlan([
      makeSubagent('analyst'),
      makeSubagent('planner', ['plan']),
      makeSubagent('executor', ['execute']),
      makeSubagent('verifier', ['verify']),
      makeSubagent('writer', ['handoff']),
    ]);

    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]?.workerIds).toStrictEqual(['worker-1', 'worker-2']);
    expect(plan.steps[1]?.workerIds).toStrictEqual(['worker-3']);
    expect(plan.steps[2]?.workerIds).toStrictEqual(['worker-4', 'worker-5']);

    const stageOneToTwo = plan.handoffs.filter(
      (handoff) => handoff.reason === 'stage-1-to-stage-2',
    );
    expect(stageOneToTwo).toHaveLength(2);
    expect(stageOneToTwo.map((edge) => edge.to)).toStrictEqual([
      'worker-3',
      'worker-3',
    ]);

    const stageTwoToThree = plan.handoffs.filter(
      (handoff) => handoff.reason === 'stage-2-to-stage-3',
    );
    expect(stageTwoToThree).toHaveLength(2);
    expect(stageTwoToThree.map((edge) => edge.from)).toStrictEqual([
      'worker-3',
      'worker-3',
    ]);
  });

  test('falls back to single-stage plan when no role grouping matches', () => {
    const plan = createAgentCoordinationPlan([
      makeSubagent('custom-alpha'),
      makeSubagent('custom-beta'),
    ]);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({
      stage: 1,
      workerIds: ['worker-1', 'worker-2'],
      dependsOn: [],
    });
    expect(plan.handoffs).toStrictEqual([]);
  });
});
