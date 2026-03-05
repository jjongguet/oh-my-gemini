import type { ComplexityTier } from './types.js';

export const BUILTIN_MODEL_HIGH = 'gemini-2.5-pro';
export const BUILTIN_MODEL_MEDIUM = 'gemini-2.5-flash';
export const BUILTIN_MODEL_LOW = 'gemini-2.0-flash-lite';

export function getDefaultModelHigh(env: NodeJS.ProcessEnv = process.env): string {
  return env.OMG_MODEL_HIGH || BUILTIN_MODEL_HIGH;
}

export function getDefaultModelMedium(env: NodeJS.ProcessEnv = process.env): string {
  return env.OMG_MODEL_MEDIUM || BUILTIN_MODEL_MEDIUM;
}

export function getDefaultModelLow(env: NodeJS.ProcessEnv = process.env): string {
  return env.OMG_MODEL_LOW || BUILTIN_MODEL_LOW;
}

export function getDefaultTierModels(
  env: NodeJS.ProcessEnv = process.env,
): Record<ComplexityTier, string> {
  return {
    LOW: getDefaultModelLow(env),
    MEDIUM: getDefaultModelMedium(env),
    HIGH: getDefaultModelHigh(env),
  };
}

export function isGoogleGeminiEndpoint(baseUrl: string): boolean {
  const normalized = baseUrl.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes('generativelanguage.googleapis.com') ||
    normalized.includes('googleapis.com')
  );
}

export function isNonGeminiProvider(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.OMG_ROUTING_FORCE_INHERIT === 'true') {
    return true;
  }

  const baseUrl = env.GEMINI_BASE_URL ?? env.GOOGLE_GENERATIVE_AI_BASE_URL ?? '';
  if (baseUrl && !isGoogleGeminiEndpoint(baseUrl)) {
    return true;
  }

  const model = env.GEMINI_MODEL ?? env.OMG_MODEL_HIGH ?? '';
  if (model && !model.toLowerCase().includes('gemini')) {
    return true;
  }

  return false;
}
