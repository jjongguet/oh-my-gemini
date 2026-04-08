import { describe, expect, test } from 'vitest';

import {
  listOmcEquivalentRoleProfiles,
  resolveSubagentRoleManagement,
} from '../../src/team/role-management.js';
import type { TeamSubagentDefinition } from '../../src/team/types.js';

describe('reliability: role management', () => {
  test('ports OMC-equivalent role profiles with expected core roles', () => {
    const profiles = listOmcEquivalentRoleProfiles();
    const profileIds = new Set(profiles.map((profile) => profile.id));

    for (const expectedRole of [
      'explore',
      'analyst',
      'planner',
      'architect',
      'executor',
      'verifier',
      'critic',
      'code-reviewer',
      'security-reviewer',
      'build-fixer',
      'writer',
    ]) {
      expect(profileIds.has(expectedRole)).toBe(true);
    }
  });

  test('resolves Gemini model routing per role tier (all tiers use default model)', () => {
    const subagents: TeamSubagentDefinition[] = [
      {
        id: 'planner',
        role: 'planner',
        mission: 'plan',
        model: 'gemini-3.1-flash-lite-preview',
      },
      {
        id: 'executor',
        role: 'executor',
        mission: 'execute',
        model: 'gemini-3.1-flash-lite-preview',
      },
      {
        id: 'writer',
        role: 'writer',
        mission: 'handoff',
        model: 'gemini-3.1-flash-lite-preview',
      },
    ];

    const report = resolveSubagentRoleManagement(subagents);
    const bySubagentId = new Map(
      report.resolvedRoles.map((entry) => [entry.subagentId, entry]),
    );

    expect(bySubagentId.get('planner')?.modelTier).toBe('reasoning');
    expect(bySubagentId.get('planner')?.recommendedGeminiModel).toBe('gemini-3.1-flash-lite-preview');

    expect(bySubagentId.get('executor')?.modelTier).toBe('balanced');
    expect(bySubagentId.get('executor')?.recommendedGeminiModel).toBe('gemini-3.1-flash-lite-preview');

    expect(bySubagentId.get('writer')?.modelTier).toBe('fast');
    expect(bySubagentId.get('writer')?.recommendedGeminiModel).toBe('gemini-3.1-flash-lite-preview');
  });

  test('supports env overrides for Gemini model routing', () => {
    const report = resolveSubagentRoleManagement(
      [
        {
          id: 'planner',
          role: 'planner',
          mission: 'plan',
          model: 'gemini-3.1-flash-lite-preview',
        },
      ],
      {
        env: {
          ...process.env,
          OMP_GEMINI_MODEL_REASONING: 'gemini-3.1-pro-preview',
        },
      },
    );

    expect(report.modelRouting.reasoning).toBe('gemini-3.1-pro-preview');
    expect(report.resolvedRoles[0]?.recommendedGeminiModel).toBe(
      'gemini-3.1-pro-preview',
    );
  });
});
