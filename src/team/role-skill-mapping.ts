import type { TeamSkillId } from './types.js';

export const CANONICAL_TEAM_SKILLS = [
  'plan',
  'team',
  'review',
  'verify',
  'handoff',
] as const;

export type CanonicalTeamSkill = (typeof CANONICAL_TEAM_SKILLS)[number];

interface RoleSkillMappingDefinition {
  skill: CanonicalTeamSkill;
  primaryRoleId: string;
  fallbackRoleIds: string[];
  aliases: string[];
}

const ROLE_SKILL_MAPPINGS: ReadonlyArray<RoleSkillMappingDefinition> = [
  {
    skill: 'plan',
    primaryRoleId: 'planner',
    fallbackRoleIds: ['analyst', 'architect', 'explore', 'scientist'],
    aliases: ['planning'],
  },
  {
    skill: 'team',
    primaryRoleId: 'executor',
    fallbackRoleIds: ['deep-executor', 'build-fixer', 'debugger', 'designer'],
    aliases: ['execute', 'execution', 'implement'],
  },
  {
    skill: 'review',
    primaryRoleId: 'code-reviewer',
    fallbackRoleIds: ['quality-reviewer', 'critic', 'security-reviewer', 'code-simplifier'],
    aliases: ['reviewer', 'code-review', 'audit'],
  },
  {
    skill: 'verify',
    primaryRoleId: 'verifier',
    fallbackRoleIds: ['qa-tester', 'test-engineer'],
    aliases: ['verification', 'validator'],
  },
  {
    skill: 'handoff',
    primaryRoleId: 'writer',
    fallbackRoleIds: ['document-specialist', 'git-master'],
    aliases: ['hand-over', 'handover', 'writer-docs'],
  },
] as const;

const CANONICAL_SKILL_SET = new Set<string>(CANONICAL_TEAM_SKILLS);

function normalizeToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function dedupeNormalized(values: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function dedupeSkills(values: TeamSkillId[]): TeamSkillId[] {
  const deduped: TeamSkillId[] = [];
  const seen = new Set<TeamSkillId>();

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

function findSkillMappingForToken(
  rawToken: string,
): RoleSkillMappingDefinition | undefined {
  const token = normalizeToken(rawToken);
  if (!token) {
    return undefined;
  }

  return ROLE_SKILL_MAPPINGS.find((mapping) => {
    if (mapping.skill === token) {
      return true;
    }

    return mapping.aliases.some((alias) => normalizeToken(alias) === token);
  });
}

function parseCanonicalSkillToken(rawToken: string): TeamSkillId | undefined {
  const token = normalizeToken(rawToken);
  if (!token) {
    return undefined;
  }

  if (CANONICAL_SKILL_SET.has(token)) {
    return token as TeamSkillId;
  }

  return findSkillMappingForToken(token)?.skill;
}

export function resolveRoleCandidatesForSkillToken(rawToken: string): string[] {
  const mapping = findSkillMappingForToken(rawToken);
  if (!mapping) {
    return [];
  }

  return dedupeNormalized([mapping.primaryRoleId, ...mapping.fallbackRoleIds]);
}

export function resolveCanonicalSkillForRoleId(
  rawRoleId: string,
): CanonicalTeamSkill | undefined {
  const roleId = normalizeToken(rawRoleId);
  if (!roleId) {
    return undefined;
  }

  const mapping = ROLE_SKILL_MAPPINGS.find((entry) => {
    if (normalizeToken(entry.primaryRoleId) === roleId) {
      return true;
    }

    return entry.fallbackRoleIds.some(
      (fallbackRoleId) => normalizeToken(fallbackRoleId) === roleId,
    );
  });

  return mapping?.skill;
}

export function listSupportedSkillAliases(): string[] {
  const aliases: string[] = [];

  for (const mapping of ROLE_SKILL_MAPPINGS) {
    aliases.push(mapping.skill);
    aliases.push(...mapping.aliases);
  }

  return dedupeNormalized(aliases);
}

export function normalizeCanonicalSkillTokens(rawTokens: string[]): {
  skills: TeamSkillId[];
  unknownTokens: string[];
} {
  const skills: TeamSkillId[] = [];
  const unknownTokens: string[] = [];

  for (const rawToken of rawTokens) {
    const parsedSkill = parseCanonicalSkillToken(rawToken);
    if (parsedSkill) {
      skills.push(parsedSkill);
      continue;
    }

    const normalized = normalizeToken(rawToken);
    if (!normalized) {
      continue;
    }

    unknownTokens.push(normalized);
  }

  return {
    skills: dedupeSkills(skills),
    unknownTokens: dedupeNormalized(unknownTokens),
  };
}

export function inferCanonicalSkillsForRole(params: {
  roleId: string;
  aliases?: string[];
}): TeamSkillId[] {
  const { roleId, aliases } = params;
  const inferred: TeamSkillId[] = [];

  const direct = resolveCanonicalSkillForRoleId(roleId);
  if (direct) {
    inferred.push(direct);
  }

  for (const alias of aliases ?? []) {
    const fromAlias = resolveCanonicalSkillForRoleId(alias);
    if (fromAlias) {
      inferred.push(fromAlias);
    }
  }

  if (inferred.length > 0) {
    return dedupeSkills(inferred);
  }

  return ['team'];
}

export function resolveSubagentSkills(params: {
  roleId: string;
  aliases?: string[];
  explicitSkills?: string[];
}): {
  skills: TeamSkillId[];
  source: 'catalog' | 'inferred';
} {
  const { roleId, aliases, explicitSkills } = params;

  if (explicitSkills && explicitSkills.length > 0) {
    const parsed = normalizeCanonicalSkillTokens(explicitSkills);
    if (parsed.unknownTokens.length > 0) {
      throw new Error(
        `unknown skill id(s): ${parsed.unknownTokens.join(', ')}. Supported: ${CANONICAL_TEAM_SKILLS.join(', ')}`,
      );
    }

    if (parsed.skills.length === 0) {
      throw new Error(
        `expected at least one canonical skill id. Supported: ${CANONICAL_TEAM_SKILLS.join(', ')}`,
      );
    }

    return {
      skills: parsed.skills,
      source: 'catalog',
    };
  }

  return {
    skills: inferCanonicalSkillsForRole({
      roleId,
      aliases,
    }),
    source: 'inferred',
  };
}
