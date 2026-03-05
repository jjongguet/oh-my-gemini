import { describe, expect, test } from 'vitest';

import {
  detectProviderFromBaseUrl,
  detectProviderFromEnv,
  getProvider,
  getProviderFromEnv,
  listProviders,
  parseProviderName,
} from '../../src/providers/index.js';

describe('reliability: providers management', () => {
  test('listProviders exposes the built-in Gemini provider adapters', () => {
    const providers = listProviders();

    expect(providers.map((provider) => provider.name).sort()).toStrictEqual([
      'google-ai',
      'vertex-ai',
    ]);
  });

  test('parseProviderName normalizes common aliases', () => {
    expect(parseProviderName('google')).toBe('google-ai');
    expect(parseProviderName('vertex_ai')).toBe('vertex-ai');
    expect(parseProviderName('gcp')).toBe('vertex-ai');
    expect(parseProviderName('custom')).toBe('unknown');
  });

  test('detectProviderFromBaseUrl identifies Google AI Studio and Vertex hosts', () => {
    expect(detectProviderFromBaseUrl('https://generativelanguage.googleapis.com')).toBe(
      'google-ai',
    );
    expect(detectProviderFromBaseUrl('https://us-central1-aiplatform.googleapis.com')).toBe(
      'vertex-ai',
    );
    expect(detectProviderFromBaseUrl('https://example.com')).toBe('unknown');
  });

  test('detectProviderFromEnv honors explicit override first', () => {
    const env: NodeJS.ProcessEnv = {
      OMG_GEMINI_PROVIDER: 'vertex-ai',
      GEMINI_API_KEY: 'api-key',
    };

    expect(detectProviderFromEnv(env)).toBe('vertex-ai');
  });

  test('detectProviderFromEnv falls back to auth heuristics', () => {
    expect(detectProviderFromEnv({ GEMINI_API_KEY: 'api-key' })).toBe('google-ai');
    expect(detectProviderFromEnv({ GOOGLE_GENAI_USE_VERTEXAI: 'true' })).toBe('vertex-ai');
    expect(detectProviderFromEnv({ GOOGLE_CLOUD_PROJECT: 'my-project' })).toBe('vertex-ai');
    expect(detectProviderFromEnv({})).toBe('unknown');
  });

  test('getProvider and getProviderFromEnv return adapter instances when available', () => {
    expect(getProvider('google-ai')?.displayName).toMatch(/google ai studio/i);
    expect(getProvider('unknown')).toBeNull();
    expect(getProviderFromEnv({ GEMINI_API_KEY: 'api-key' })?.name).toBe('google-ai');
  });
});
