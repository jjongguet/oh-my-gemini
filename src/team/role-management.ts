import type { TeamSubagentDefinition } from './types.js';

export type TeamRoleCostTier = 'FREE' | 'CHEAP' | 'EXPENSIVE';
export type TeamRoleCategory =
  | 'exploration'
  | 'specialist'
  | 'advisor'
  | 'utility'
  | 'orchestration'
  | 'planner'
  | 'reviewer';
export type TeamRoleModelTier = 'fast' | 'balanced' | 'reasoning';

export interface TeamRoleProfile {
  id: string;
  description: string;
  category: TeamRoleCategory;
  costTier: TeamRoleCostTier;
  modelTier: TeamRoleModelTier;
  promptAlias?: string;
  aliases?: string[];
  tools?: string[];
  disallowedTools?: string[];
}

export interface GeminiRoleModelRouting {
  fast: string;
  balanced: string;
  reasoning: string;
}

export interface ResolvedSubagentRoleProfile {
  subagentId: string;
  roleId: string;
  profileId?: string;
  category?: TeamRoleCategory;
  costTier?: TeamRoleCostTier;
  modelTier: TeamRoleModelTier;
  recommendedGeminiModel: string;
  matchedBy: 'id' | 'role' | 'alias' | 'unknown';
  promptAlias?: string;
  tools?: string[];
  disallowedTools?: string[];
}

export interface SubagentRoleManagementReport {
  version: 1;
  source: 'omc-port';
  modelRouting: GeminiRoleModelRouting;
  resolvedRoles: ResolvedSubagentRoleProfile[];
  unmatchedRoles: string[];
}

const DEFAULT_GEMINI_MODEL_ROUTING: GeminiRoleModelRouting = {
  fast: 'gemini-2.5-flash',
  balanced: 'gemini-2.5-flash',
  reasoning: 'gemini-2.5-pro',
};

const OMC_EQUIVALENT_ROLE_PROFILES: readonly TeamRoleProfile[] = [
  {
    id: 'explore',
    description: 'Fast codebase search and symbol mapping.',
    category: 'exploration',
    costTier: 'CHEAP',
    modelTier: 'fast',
    promptAlias: 'explore',
    tools: ['read', 'glob', 'grep'],
  },
  {
    id: 'analyst',
    description: 'Requirements clarity and hidden-constraint discovery.',
    category: 'planner',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'analyst',
    tools: ['read', 'glob', 'grep', 'web-search'],
  },
  {
    id: 'planner',
    description: 'Dependency-aware planning and risk sequencing.',
    category: 'planner',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'planner',
    aliases: ['plan'],
    tools: ['read', 'glob', 'grep', 'web-search'],
  },
  {
    id: 'architect',
    description: 'System design and hard debugging advisor.',
    category: 'advisor',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'architect',
    tools: ['read', 'glob', 'grep', 'web-search', 'web-fetch'],
  },
  {
    id: 'debugger',
    description: 'Root-cause analysis and regression isolation.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'debugger',
    tools: ['read', 'glob', 'grep', 'bash'],
  },
  {
    id: 'executor',
    description: 'Focused implementation and refactoring execution.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'executor',
    aliases: ['execute'],
    tools: ['read', 'glob', 'grep', 'edit', 'write', 'bash'],
  },
  {
    id: 'verifier',
    description: 'Completion evidence, claim validation, and test adequacy.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'verifier',
    aliases: ['verify'],
    tools: ['read', 'glob', 'grep', 'bash'],
  },
  {
    id: 'quality-reviewer',
    description: 'Logic defects, maintainability, and anti-pattern review.',
    category: 'reviewer',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'quality-reviewer',
    tools: ['read', 'glob', 'grep', 'bash'],
  },
  {
    id: 'security-reviewer',
    description: 'Security audit specialist for trust boundaries and vulns.',
    category: 'reviewer',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'security-reviewer',
    tools: ['read', 'glob', 'grep', 'bash'],
  },
  {
    id: 'code-reviewer',
    description: 'Comprehensive code and API contract review.',
    category: 'reviewer',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'code-reviewer',
    aliases: ['api-reviewer'],
    tools: ['read', 'glob', 'grep', 'bash'],
  },
  {
    id: 'deep-executor',
    description: 'Deep autonomous execution for complex multi-step changes.',
    category: 'specialist',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'deep-executor',
    tools: ['read', 'glob', 'grep', 'edit', 'write', 'bash'],
  },
  {
    id: 'test-engineer',
    description: 'Test strategy, coverage, and flaky hardening.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'test-engineer',
    tools: ['read', 'glob', 'grep', 'edit', 'write', 'bash'],
  },
  {
    id: 'build-fixer',
    description: 'Build and type failure resolution specialist.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'build-fixer',
    tools: ['read', 'glob', 'grep', 'edit', 'write', 'bash'],
  },
  {
    id: 'designer',
    description: 'UI/UX design and interaction implementation specialist.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'designer',
    tools: ['read', 'glob', 'grep', 'edit', 'write', 'bash'],
  },
  {
    id: 'writer',
    description: 'Technical writing for docs, handoff, and migration notes.',
    category: 'specialist',
    costTier: 'FREE',
    modelTier: 'fast',
    promptAlias: 'writer',
    aliases: ['handoff'],
    tools: ['read', 'glob', 'grep', 'edit', 'write'],
  },
  {
    id: 'qa-tester',
    description: 'Interactive CLI and runtime validation specialist.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'qa-tester',
    tools: ['bash', 'read', 'glob', 'grep'],
  },
  {
    id: 'scientist',
    description: 'Data analysis and research execution specialist.',
    category: 'specialist',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'scientist',
    aliases: ['data-analyst'],
    tools: ['read', 'glob', 'grep', 'bash', 'python-repl'],
  },
  {
    id: 'git-master',
    description: 'Git commit/rebase/history hygiene specialist.',
    category: 'utility',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'git-master',
    tools: ['read', 'glob', 'grep', 'bash'],
  },
  {
    id: 'code-simplifier',
    description: 'Behavior-preserving simplification and consistency pass.',
    category: 'reviewer',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'code-simplifier',
    tools: ['read', 'glob', 'grep', 'edit', 'write'],
  },
  {
    id: 'critic',
    description: 'Critical review of plans before execution.',
    category: 'reviewer',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'critic',
    tools: ['read', 'glob', 'grep'],
  },
  {
    id: 'document-specialist',
    description: 'External documentation and SDK/package lookup specialist.',
    category: 'exploration',
    costTier: 'CHEAP',
    modelTier: 'balanced',
    promptAlias: 'document-specialist',
    aliases: ['dependency-expert', 'researcher'],
    tools: ['read', 'glob', 'grep', 'web-search', 'web-fetch'],
  },
  {
    id: 'harsh-critic',
    description: 'Deep, adversarial-style gap analysis for high-risk plans.',
    category: 'reviewer',
    costTier: 'EXPENSIVE',
    modelTier: 'reasoning',
    promptAlias: 'harsh-critic',
    tools: ['read', 'glob', 'grep'],
  },
] as const;

function normalizeRoleToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeOptionalModel(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function resolveGeminiRoleModelRouting(
  env: NodeJS.ProcessEnv = process.env,
): GeminiRoleModelRouting {
  const fast = normalizeOptionalModel(env.OMG_GEMINI_MODEL_FAST);
  const balanced = normalizeOptionalModel(env.OMG_GEMINI_MODEL_BALANCED);
  const reasoning = normalizeOptionalModel(env.OMG_GEMINI_MODEL_REASONING);

  return {
    fast: fast ?? DEFAULT_GEMINI_MODEL_ROUTING.fast,
    balanced: balanced ?? DEFAULT_GEMINI_MODEL_ROUTING.balanced,
    reasoning: reasoning ?? DEFAULT_GEMINI_MODEL_ROUTING.reasoning,
  };
}

function roleProfileIndex(): {
  byId: Map<string, TeamRoleProfile>;
  byAlias: Map<string, TeamRoleProfile>;
} {
  const byId = new Map<string, TeamRoleProfile>();
  const byAlias = new Map<string, TeamRoleProfile>();

  for (const profile of OMC_EQUIVALENT_ROLE_PROFILES) {
    const normalizedId = normalizeRoleToken(profile.id);
    if (normalizedId) {
      byId.set(normalizedId, profile);
      byAlias.set(normalizedId, profile);
    }

    for (const alias of profile.aliases ?? []) {
      const normalizedAlias = normalizeRoleToken(alias);
      if (!normalizedAlias || byAlias.has(normalizedAlias)) {
        continue;
      }
      byAlias.set(normalizedAlias, profile);
    }
  }

  return {
    byId,
    byAlias,
  };
}

function resolveRecommendedGeminiModel(
  tier: TeamRoleModelTier,
  routing: GeminiRoleModelRouting,
): string {
  switch (tier) {
    case 'fast':
      return routing.fast;
    case 'reasoning':
      return routing.reasoning;
    case 'balanced':
    default:
      return routing.balanced;
  }
}

export function listOmcEquivalentRoleProfiles(): TeamRoleProfile[] {
  return OMC_EQUIVALENT_ROLE_PROFILES.map((profile) => ({
    ...profile,
    aliases: profile.aliases ? [...profile.aliases] : undefined,
    tools: profile.tools ? [...profile.tools] : undefined,
    disallowedTools: profile.disallowedTools
      ? [...profile.disallowedTools]
      : undefined,
  }));
}

export function resolveSubagentRoleManagement(
  subagents: TeamSubagentDefinition[],
  options?: {
    env?: NodeJS.ProcessEnv;
  },
): SubagentRoleManagementReport {
  const routing = resolveGeminiRoleModelRouting(options?.env);
  const { byId, byAlias } = roleProfileIndex();
  const unmatchedRoles: string[] = [];

  const resolvedRoles = subagents.map<ResolvedSubagentRoleProfile>((subagent) => {
    const normalizedId = normalizeRoleToken(subagent.id);
    const normalizedRole = normalizeRoleToken(subagent.role);
    const normalizedAliases = (subagent.aliases ?? []).map((alias) =>
      normalizeRoleToken(alias),
    );

    const idMatch = normalizedId ? byId.get(normalizedId) : undefined;
    const roleMatch = normalizedRole ? byAlias.get(normalizedRole) : undefined;
    const aliasMatch = normalizedAliases
      .map((alias) => byAlias.get(alias))
      .find((candidate): candidate is TeamRoleProfile => candidate !== undefined);

    const profile = idMatch ?? roleMatch ?? aliasMatch;

    if (!profile) {
      unmatchedRoles.push(subagent.id);
      return {
        subagentId: subagent.id,
        roleId: subagent.role,
        modelTier: 'balanced',
        recommendedGeminiModel: routing.balanced,
        matchedBy: 'unknown',
      };
    }

    const matchedBy: ResolvedSubagentRoleProfile['matchedBy'] =
      profile === idMatch
        ? 'id'
        : profile === roleMatch
          ? 'role'
          : 'alias';

    return {
      subagentId: subagent.id,
      roleId: subagent.role,
      profileId: profile.id,
      category: profile.category,
      costTier: profile.costTier,
      modelTier: profile.modelTier,
      recommendedGeminiModel: resolveRecommendedGeminiModel(
        profile.modelTier,
        routing,
      ),
      matchedBy,
      promptAlias: profile.promptAlias,
      tools: profile.tools ? [...profile.tools] : undefined,
      disallowedTools: profile.disallowedTools
        ? [...profile.disallowedTools]
        : undefined,
    };
  });

  return {
    version: 1,
    source: 'omc-port',
    modelRouting: routing,
    resolvedRoles,
    unmatchedRoles,
  };
}
