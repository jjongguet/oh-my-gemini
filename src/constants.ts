export const DEFAULT_WORKERS = 3;
export const MIN_WORKERS = 1;
export const MAX_WORKERS = 8;

export const DEFAULT_FIX_LOOP_CAP = 3;

export const DEFAULT_MAX_WORKER_RESTARTS = 3;
export const MIN_MAX_WORKER_RESTARTS = 0;
export const MAX_MAX_WORKER_RESTARTS = 10;
export const CANONICAL_TERMINAL_PHASE = 'completed' as const;

export const CLI_USAGE_EXIT_CODE = 2;
export const INVALID_USAGE_EXIT_CODE = CLI_USAGE_EXIT_CODE;
export const INVALID_ARGUMENT_EXIT_CODE = CLI_USAGE_EXIT_CODE;
export const CLI_USAGE_ERROR_EXIT_CODE = CLI_USAGE_EXIT_CODE;

export const LEGACY_RUNNING_SUCCESS_ENV_FLAG = 'OMG_LEGACY_RUNNING_SUCCESS';
export const LEGACY_RUNNING_SUCCESS_ENV = LEGACY_RUNNING_SUCCESS_ENV_FLAG;
export const LEGACY_VERIFY_GATE_PASS_ENV_FLAG = 'OMG_LEGACY_VERIFY_GATE_PASS';
export const LEGACY_VERIFY_GATE_PASS_ENV = LEGACY_VERIFY_GATE_PASS_ENV_FLAG;

export interface LegacyBypassDescriptor {
  envFlag: string;
  mode: 'running-success' | 'verify-gate-pass';
  description: string;
  warning: string;
}

const LEGACY_BYPASS_DESCRIPTORS = {
  runningSuccess: {
    envFlag: LEGACY_RUNNING_SUCCESS_ENV_FLAG,
    mode: 'running-success',
    description: 'treat runtime status=running as a successful terminal completion',
    warning:
      'Deprecated compatibility bypass: OMG_LEGACY_RUNNING_SUCCESS=1 allows running snapshots to pass. Remove this temporary flag.',
  },
  verifyGatePass: {
    envFlag: LEGACY_VERIFY_GATE_PASS_ENV_FLAG,
    mode: 'verify-gate-pass',
    description: 'treat missing verifyBaselinePassed as a successful verify gate',
    warning:
      'Deprecated compatibility bypass: OMG_LEGACY_VERIFY_GATE_PASS=1 allows missing verify baseline signals to pass. Remove this temporary flag.',
  },
} as const satisfies Record<string, LegacyBypassDescriptor>;

export interface LegacyBypassAuditRecord {
  envFlag: string;
  mode: LegacyBypassDescriptor['mode'];
  usedAt: string;
  context: string;
  description: string;
  warning: string;
}

export function isLegacyRunningSuccessEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[LEGACY_RUNNING_SUCCESS_ENV_FLAG] === '1';
}

export function isLegacyVerifyGatePassEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[LEGACY_VERIFY_GATE_PASS_ENV_FLAG] === '1';
}

export function listLegacyBypassDeprecationWarnings(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const warnings: string[] = [];

  if (isLegacyRunningSuccessEnabled(env)) {
    warnings.push(LEGACY_BYPASS_DESCRIPTORS.runningSuccess.warning);
  }
  if (isLegacyVerifyGatePassEnabled(env)) {
    warnings.push(LEGACY_BYPASS_DESCRIPTORS.verifyGatePass.warning);
  }

  return warnings;
}

export function buildLegacyRunningSuccessAuditRecord(
  context: string,
  usedAt = new Date().toISOString(),
): LegacyBypassAuditRecord {
  return {
    ...LEGACY_BYPASS_DESCRIPTORS.runningSuccess,
    context,
    usedAt,
  };
}

export function buildLegacyVerifyGatePassAuditRecord(
  context: string,
  usedAt = new Date().toISOString(),
): LegacyBypassAuditRecord {
  return {
    ...LEGACY_BYPASS_DESCRIPTORS.verifyGatePass,
    context,
    usedAt,
  };
}


export interface LegacyBypassUsage {
  flag: string;
  auditCode: LegacyBypassDescriptor['mode'];
  enabled: boolean;
  description: string;
  deprecationWarning: string;
}

export function getLegacyBypassUsages(
  env: NodeJS.ProcessEnv = process.env,
): LegacyBypassUsage[] {
  return [
    {
      flag: LEGACY_RUNNING_SUCCESS_ENV_FLAG,
      auditCode: LEGACY_BYPASS_DESCRIPTORS.runningSuccess.mode,
      enabled: isLegacyRunningSuccessEnabled(env),
      description: LEGACY_BYPASS_DESCRIPTORS.runningSuccess.description,
      deprecationWarning: LEGACY_BYPASS_DESCRIPTORS.runningSuccess.warning,
    },
    {
      flag: LEGACY_VERIFY_GATE_PASS_ENV_FLAG,
      auditCode: LEGACY_BYPASS_DESCRIPTORS.verifyGatePass.mode,
      enabled: isLegacyVerifyGatePassEnabled(env),
      description: LEGACY_BYPASS_DESCRIPTORS.verifyGatePass.description,
      deprecationWarning: LEGACY_BYPASS_DESCRIPTORS.verifyGatePass.warning,
    },
  ];
}

export function getEnabledLegacyBypassUsages(
  env: NodeJS.ProcessEnv = process.env,
): LegacyBypassUsage[] {
  return getLegacyBypassUsages(env).filter((usage) => usage.enabled);
}

export function emitLegacyBypassAuditLogs(params: {
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
  scope?: string;
} = {}): LegacyBypassUsage[] {
  const enabled = getEnabledLegacyBypassUsages(params.env ?? process.env);
  const log = params.log ?? ((message: string) => console.warn(message));
  const scope = params.scope ?? 'runtime';

  for (const usage of enabled) {
    log(
      `[legacy-bypass][audit] scope=${scope} flag=${usage.flag} code=${usage.auditCode} detail=${usage.description}`,
    );
    log(`[legacy-bypass][deprecation] ${usage.deprecationWarning}`);
  }

  return enabled;
}

export const DEFAULT_VERIFY_SUITES = [
  'typecheck',
  'smoke',
  'integration',
  'reliability',
] as const;
