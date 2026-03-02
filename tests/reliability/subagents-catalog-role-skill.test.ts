import { describe, expect, test } from 'vitest';

import {
  createDefaultSubagentCatalog,
} from '../../src/team/subagents-blueprint.js';
import { resolveSubagentSelection } from '../../src/team/subagents-catalog.js';
import type { TeamSubagentCatalog } from '../../src/team/types.js';

describe('reliability: subagent catalog role-skill mapping', () => {
  test('canonical skill tokens resolve to primary role ids', () => {
    const catalog = createDefaultSubagentCatalog();

    const selection = resolveSubagentSelection(catalog, [
      'plan',
      'team',
      'review',
      'verify',
      'handoff',
    ]);

    expect(selection.map((subagent) => subagent.id)).toStrictEqual([
      'planner',
      'executor',
      'code-reviewer',
      'verifier',
      'writer',
    ]);
  });

  test('catalog-defined aliases and skills can override token routing', () => {
    const catalog: TeamSubagentCatalog = {
      schemaVersion: 1,
      unifiedModel: 'gemini-2.5-pro',
      subagents: [
        {
          id: 'review-guardian',
          role: 'review-guardian',
          mission: 'Run adversarial review checks.',
          model: 'gemini-2.5-pro',
          aliases: ['audit'],
          skills: ['review'],
        },
        {
          id: 'executor',
          role: 'executor',
          mission: 'Execute implementation tasks.',
          model: 'gemini-2.5-pro',
          skills: ['team'],
        },
      ],
    };

    const selection = resolveSubagentSelection(catalog, ['audit', 'team']);
    expect(selection.map((subagent) => subagent.id)).toStrictEqual([
      'review-guardian',
      'executor',
    ]);
  });

  test('unknown ids surface available ids and supported skill aliases', () => {
    const catalog = createDefaultSubagentCatalog();

    expect(() =>
      resolveSubagentSelection(catalog, ['does-not-exist']),
    ).toThrow(/supported skill aliases/i);
  });
});
