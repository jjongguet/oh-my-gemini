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

export const DEFAULT_VERIFY_SUITES = [
  'typecheck',
  'smoke',
  'integration',
  'reliability',
] as const;
