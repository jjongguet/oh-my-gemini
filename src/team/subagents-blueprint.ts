import type { TeamSubagentCatalog, TeamSubagentDefinition } from './types.js';

export const DEFAULT_UNIFIED_SUBAGENT_MODEL = 'gemini-2.5-pro';

export const DEFAULT_SUBAGENT_BLUEPRINTS: ReadonlyArray<
  Omit<TeamSubagentDefinition, 'model'>
> = [
  {
    id: 'analyst',
    role: 'analyst',
    mission:
      'Analyze requirement gaps and acceptance criteria before planning starts.',
  },
  {
    id: 'architect',
    role: 'architect',
    mission:
      'Define boundaries, interfaces, and architecture trade-offs using code evidence.',
  },
  {
    id: 'build-fixer',
    role: 'build-fixer',
    mission:
      'Resolve build, type, and compile failures with minimal, low-risk diffs.',
  },
  {
    id: 'code-reviewer',
    role: 'code-reviewer',
    mission:
      'Run severity-rated review for correctness, security, and maintainability.',
  },
  {
    id: 'code-simplifier',
    role: 'code-simplifier',
    mission:
      'Simplify changed code for clarity and consistency without changing behavior.',
  },
  {
    id: 'critic',
    role: 'critic',
    mission:
      'Critique plans for completeness, implementability, and spec compliance.',
  },
  {
    id: 'debugger',
    role: 'debugger',
    mission:
      'Isolate deterministic root causes and propose reproducible bug fixes.',
  },
  {
    id: 'deep-executor',
    role: 'deep-executor',
    mission:
      'Execute complex multi-step implementation tasks end-to-end with verification.',
  },
  {
    id: 'designer',
    role: 'designer',
    mission:
      'Design polished UI/UX implementations with production-ready interaction details.',
  },
  {
    id: 'document-specialist',
    role: 'document-specialist',
    mission:
      'Research official external documentation and version compatibility references.',
  },
  {
    id: 'executor',
    role: 'executor',
    mission:
      'Implement scoped tasks precisely with minimal, reviewable code changes.',
  },
  {
    id: 'explore',
    role: 'explore',
    mission:
      'Map files, symbols, and relationships through fast read-only code search.',
  },
  {
    id: 'git-master',
    role: 'git-master',
    mission:
      'Prepare atomic commits and keep branch history clean and recoverable.',
  },
  {
    id: 'planner',
    role: 'planner',
    mission:
      'Create dependency-aware execution plans with explicit acceptance criteria.',
  },
  {
    id: 'qa-tester',
    role: 'qa-tester',
    mission:
      'Run interactive runtime checks and report reproducible validation evidence.',
  },
  {
    id: 'quality-reviewer',
    role: 'quality-reviewer',
    mission:
      'Detect logic defects, anti-patterns, and maintainability regressions.',
  },
  {
    id: 'scientist',
    role: 'scientist',
    mission:
      'Execute data analysis and produce evidence-backed findings and caveats.',
  },
  {
    id: 'security-reviewer',
    role: 'security-reviewer',
    mission:
      'Audit vulnerabilities, trust boundaries, and authentication/authorization risks.',
  },
  {
    id: 'test-engineer',
    role: 'test-engineer',
    mission:
      'Design robust test strategy, strengthen coverage, and harden flaky paths.',
  },
  {
    id: 'verifier',
    role: 'verifier',
    mission:
      'Verify completion claims against fresh evidence and acceptance criteria.',
  },
  {
    id: 'writer',
    role: 'writer',
    mission:
      'Publish concise technical docs, migration notes, and implementation handoff.',
  },
] as const;

export function createDefaultSubagentCatalog(
  sourcePath?: string,
): TeamSubagentCatalog {
  return {
    schemaVersion: 1,
    unifiedModel: DEFAULT_UNIFIED_SUBAGENT_MODEL,
    sourcePath,
    subagents: DEFAULT_SUBAGENT_BLUEPRINTS.map((subagent) => ({
      ...subagent,
      model: DEFAULT_UNIFIED_SUBAGENT_MODEL,
    })),
  };
}

