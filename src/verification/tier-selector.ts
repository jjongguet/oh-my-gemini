export interface ChangeMetadata {
  filesChanged: number;
  linesChanged: number;
  hasArchitecturalChanges: boolean;
  hasSecurityImplications: boolean;
  testCoverage: 'none' | 'partial' | 'full';
}

export type VerificationTier = 'LIGHT' | 'STANDARD' | 'THOROUGH';

export interface VerificationAgent {
  agent: string;
  model: 'haiku' | 'sonnet' | 'opus';
  evidenceRequired: string[];
}

const TIER_AGENTS: Record<VerificationTier, VerificationAgent> = {
  LIGHT: {
    agent: 'architect-low',
    model: 'haiku',
    evidenceRequired: ['lsp_diagnostics clean'],
  },
  STANDARD: {
    agent: 'architect-medium',
    model: 'sonnet',
    evidenceRequired: ['lsp_diagnostics clean', 'build pass'],
  },
  THOROUGH: {
    agent: 'architect',
    model: 'opus',
    evidenceRequired: ['full architect review', 'all tests pass', 'no regressions'],
  },
};

export function selectVerificationTier(changes: ChangeMetadata): VerificationTier {
  if (changes.hasSecurityImplications || changes.hasArchitecturalChanges) {
    return 'THOROUGH';
  }

  if (changes.filesChanged > 20) {
    return 'THOROUGH';
  }

  if (
    changes.filesChanged < 5 &&
    changes.linesChanged < 100 &&
    changes.testCoverage === 'full'
  ) {
    return 'LIGHT';
  }

  return 'STANDARD';
}

export function getVerificationAgent(tier: VerificationTier): VerificationAgent {
  return TIER_AGENTS[tier];
}

export function detectArchitecturalChanges(files: string[]): boolean {
  const architecturalPatterns = [
    /config\.(ts|js|json)$/i,
    /schema\.(ts|prisma|sql)$/i,
    /definitions\.ts$/i,
    /(?:^|\/)types\.ts$/i,
    /package\.json$/i,
    /tsconfig\.json$/i,
  ];

  return files.some((file) => architecturalPatterns.some((pattern) => pattern.test(file)));
}

export function detectSecurityImplications(files: string[]): boolean {
  const securityPatterns = [
    /\/auth\//i,
    /\/security\//i,
    /(^|[\/-])permissions?\.(ts|js)$/i,
    /(^|[\/-])credentials?\.(ts|js|json)$/i,
    /(^|[\/-])secrets?\.(ts|js|json|ya?ml)$/i,
    /(^|[\/-])tokens?\.(ts|js|json)$/i,
    /\.(env|pem|key)(\.|$)/i,
    /(^|[\/-])passwords?\.(ts|js|json)$/i,
    /(^|[\/-])oauth/i,
    /(^|[\/-])jwt/i,
  ];

  return files.some((file) => securityPatterns.some((pattern) => pattern.test(file)));
}

export function buildChangeMetadata(
  files: string[],
  linesChanged: number,
  testCoverage: 'none' | 'partial' | 'full' = 'partial',
): ChangeMetadata {
  return {
    filesChanged: files.length,
    linesChanged,
    hasArchitecturalChanges: detectArchitecturalChanges(files),
    hasSecurityImplications: detectSecurityImplications(files),
    testCoverage,
  };
}
