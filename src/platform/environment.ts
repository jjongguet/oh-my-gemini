const SAFE_ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const DEFAULT_RUNTIME_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'SHELL',
  'COMSPEC',
  'TERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TMPDIR',
  'TMP',
  'TEMP',
  'NO_PROXY',
  'no_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
] as const;

export const GEMINI_ENV_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_BASE_URL',
  'GOOGLE_GENAI_USE_VERTEXAI',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_LOCATION',
  'GEMINI_EXPERIMENTAL_ENABLE_AGENTS',
  'OMG_EXPERIMENTAL_ENABLE_AGENTS',
] as const;

export interface BuildRuntimeEnvironmentOptions {
  sourceEnv?: NodeJS.ProcessEnv;
  includeKeys?: readonly string[];
  includeGeminiApi?: boolean;
  overrides?: Record<string, string | undefined>;
}

function isSafeEnvKey(key: string): boolean {
  return SAFE_ENV_KEY_PATTERN.test(key);
}

function readEnvValue(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // Avoid shell command breakouts when this env record is rendered as shell assignments.
  return trimmed.replace(/[\x00\r\n]/g, '');
}

export function pickEnvironment(
  keys: readonly string[],
  sourceEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const output: Record<string, string> = {};

  for (const key of keys) {
    if (!isSafeEnvKey(key)) {
      continue;
    }

    const value = readEnvValue(sourceEnv[key]);
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

/**
 * Resolve Gemini API environment variables with compatibility fallbacks.
 * If only GOOGLE_API_KEY is present, mirror it to GEMINI_API_KEY for CLI calls.
 */
export function resolveGeminiApiEnvironment(
  sourceEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const resolved = pickEnvironment(GEMINI_ENV_KEYS, sourceEnv);

  const geminiApiKey = resolved.GEMINI_API_KEY ?? resolved.GOOGLE_API_KEY;
  if (geminiApiKey) {
    resolved.GEMINI_API_KEY = geminiApiKey;
    resolved.GOOGLE_API_KEY = resolved.GOOGLE_API_KEY ?? geminiApiKey;
  }

  return resolved;
}

export function applyEnvironmentOverrides(
  base: Record<string, string>,
  overrides?: Record<string, string | undefined>,
): Record<string, string> {
  if (!overrides) {
    return base;
  }

  for (const [key, rawValue] of Object.entries(overrides)) {
    if (!isSafeEnvKey(key)) {
      continue;
    }

    const value = readEnvValue(rawValue);
    if (value !== undefined) {
      base[key] = value;
    }
  }

  return base;
}

/**
 * Build a shell-safe runtime env map with optional Gemini API propagation.
 */
export function buildRuntimeEnvironment(
  options: BuildRuntimeEnvironmentOptions = {},
): Record<string, string> {
  const sourceEnv = options.sourceEnv ?? process.env;
  const includeKeys = options.includeKeys ?? DEFAULT_RUNTIME_ENV_ALLOWLIST;

  const runtimeEnv = pickEnvironment(includeKeys, sourceEnv);

  if (options.includeGeminiApi !== false) {
    applyEnvironmentOverrides(runtimeEnv, resolveGeminiApiEnvironment(sourceEnv));
  }

  applyEnvironmentOverrides(runtimeEnv, options.overrides);
  return runtimeEnv;
}
