import { describe, expect, test } from 'vitest';

import {
  CANONICAL_TEAM_SKILLS,
  inferCanonicalSkillsForRole,
  listCanonicalRoleSkillMappings,
  normalizeCanonicalSkillTokens,
  resolveCanonicalSkillForRoleId,
  resolveRoleCandidatesForSkillToken,
  resolveSubagentSkills,
} from '../../src/team/role-skill-mapping.js';

describe('reliability: role-skill mapping', () => {
  test('resolves canonical skill for primary and fallback roles', () => {
    expect(resolveCanonicalSkillForRoleId('planner')).toBe('plan');
    expect(resolveCanonicalSkillForRoleId('qa-tester')).toBe('verify');
    expect(resolveCanonicalSkillForRoleId('security-reviewer')).toBe('review');
  });

  test('normalizes canonical skill tokens and reports unknown entries', () => {
    const parsed = normalizeCanonicalSkillTokens([
      'PLAN',
      'verification',
      'handover',
      'not-a-skill',
    ]);

    expect(parsed.skills).toStrictEqual(['plan', 'verify', 'handoff']);
    expect(parsed.unknownTokens).toStrictEqual(['not-a-skill']);
  });

  test('resolves role candidates from skill aliases', () => {
    expect(resolveRoleCandidatesForSkillToken('review')).toContain('code-reviewer');
    expect(resolveRoleCandidatesForSkillToken('execute')).toContain('executor');
  });

  test('infers canonical skills for unknown roles with safe fallback', () => {
    expect(
      inferCanonicalSkillsForRole({ roleId: 'custom-role' }),
    ).toStrictEqual(['team']);
  });

  test('accepts explicit canonical skill list and rejects unknown ids', () => {
    const resolved = resolveSubagentSkills({
      roleId: 'planner',
      explicitSkills: ['plan', 'verify'],
    });

    expect(resolved.skills).toStrictEqual(['plan', 'verify']);
    expect(resolved.source).toBe('catalog');

    expect(() =>
      resolveSubagentSkills({
        roleId: 'planner',
        explicitSkills: ['not-real-skill'],
      }),
    ).toThrow(/unknown skill id\(s\)/i);
  });

  test('canonical skill inventory remains stable', () => {
    expect(CANONICAL_TEAM_SKILLS).toStrictEqual([
      'plan',
      'team',
      'review',
      'verify',
      'handoff',
    ]);
  });

  test('exports deterministic canonical role-skill mappings', () => {
    const mappings = listCanonicalRoleSkillMappings();
    expect(mappings.map((entry) => entry.skill)).toStrictEqual([
      'plan',
      'team',
      'review',
      'verify',
      'handoff',
    ]);
    expect(mappings[0]).toMatchObject({
      skill: 'plan',
      primaryRoleId: 'planner',
    });
    expect(mappings[1]?.fallbackRoleIds).toContain('debugger');
  });
});
