import { describe, expect, test, vi } from 'vitest';

import {
  GeminiApiClient,
  isThinkingModel,
  type GeminiApiFetch,
  type GeminiGenerateContentRequest,
} from '../../src/providers/api-client.js';

const CONTENTS = [{ parts: [{ text: 'hello' }] }];

const SUCCESS_BODY = JSON.stringify({
  candidates: [{ content: { parts: [{ text: 'hi' }] } }],
});

function okResponse(): Response {
  return new Response(SUCCESS_BODY, { status: 200, statusText: 'OK' });
}

function createMockProvider() {
  return {
    name: 'google-ai' as const,
    displayName: 'Google AI',
    aliases: [] as string[],
    defaultApiVersion: 'v1beta',
    detectFromEnv: () => true,
    checkAuth: () => true,
    resolveConfig: () => ({
      provider: 'google-ai' as const,
      apiVersion: 'v1beta',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'test-key',
    }),
    buildGenerateContentUrl: (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    buildRequestHeaders: () => ({
      'x-goog-api-key': 'test-key',
    }),
  };
}

describe('isThinkingModel', () => {
  test('identifies models with "thinking" in the name', () => {
    expect(isThinkingModel('gemini-2.5-flash-thinking')).toBe(true);
    expect(isThinkingModel('gemini-2.5-pro-thinking')).toBe(true);
    expect(isThinkingModel('gemini-2.5-pro-thinking-001')).toBe(true);
  });

  test('identifies models with "think" in the name', () => {
    expect(isThinkingModel('gemini-2.5-flash-think')).toBe(true);
    expect(isThinkingModel('gemini-think-pro')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(isThinkingModel('Gemini-2.5-Flash-Thinking')).toBe(true);
    expect(isThinkingModel('GEMINI-2.5-PRO-THINKING')).toBe(true);
  });

  test('returns false for normal models', () => {
    expect(isThinkingModel('gemini-2.5-flash')).toBe(false);
    expect(isThinkingModel('gemini-2.5-pro')).toBe(false);
    expect(isThinkingModel('gemini-2.5-flash-lite')).toBe(false);
    expect(isThinkingModel('gemini-ultra')).toBe(false);
  });

  test('trims whitespace', () => {
    expect(isThinkingModel('  gemini-2.5-flash-thinking  ')).toBe(true);
    expect(isThinkingModel('  gemini-2.5-flash  ')).toBe(false);
  });
});

describe('model-aware request timeouts', () => {
  test('defaults to 30s for normal models', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(30_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro')).toBe(30_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash-lite')).toBe(30_000);
  });

  test('defaults to 120s for thinking models', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash-thinking')).toBe(120_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(120_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking-001')).toBe(120_000);
  });

  test('explicit requestTimeoutMs overrides model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      requestTimeoutMs: 60_000,
    });

    // Override applies to both normal and thinking models
    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(60_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(60_000);
  });

  test('OMP_REQUEST_TIMEOUT_MS env var overrides model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      env: { OMP_REQUEST_TIMEOUT_MS: '90000' },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(90_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(90_000);
  });

  test('GEMINI_REQUEST_TIMEOUT_MS env var overrides model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      env: { GEMINI_REQUEST_TIMEOUT_MS: '45000' },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(45_000);
  });

  test('OMP_REQUEST_TIMEOUT_MS takes precedence over GEMINI_REQUEST_TIMEOUT_MS', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      env: {
        OMP_REQUEST_TIMEOUT_MS: '90000',
        GEMINI_REQUEST_TIMEOUT_MS: '45000',
      },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(90_000);
  });

  test('explicit requestTimeoutMs takes precedence over env var', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      requestTimeoutMs: 60_000,
      env: { OMP_REQUEST_TIMEOUT_MS: '90000' },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(60_000);
  });

  test('invalid env var is ignored, falls back to model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      env: { OMP_REQUEST_TIMEOUT_MS: 'not-a-number' },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(30_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(120_000);
  });

  test('negative env var is ignored, falls back to model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      env: { OMP_REQUEST_TIMEOUT_MS: '-5000' },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(30_000);
  });

  test('empty env var is ignored, falls back to model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      env: { OMP_REQUEST_TIMEOUT_MS: '' },
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(30_000);
  });

  test('zero requestTimeoutMs is ignored, falls back to model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      requestTimeoutMs: 0,
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(30_000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(120_000);
  });

  test('negative requestTimeoutMs is ignored, falls back to model default', () => {
    const client = new GeminiApiClient({
      provider: createMockProvider(),
      requestTimeoutMs: -1000,
    });

    expect(client.resolveRequestTimeoutMs('gemini-2.5-flash')).toBe(30_000);
  });
});

describe('generateContent uses model-aware timeout', () => {
  test('uses 30s timeout for normal model requests', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<GeminiApiFetch>(async (_url, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return okResponse();
    });

    const client = new GeminiApiClient({
      provider: createMockProvider(),
      fetchImpl: fetchMock,
      retry: { maxRetries: 0 },
    });

    const input: GeminiGenerateContentRequest = {
      model: 'gemini-2.5-flash',
      contents: CONTENTS,
    };

    await client.generateContent(input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);
  });

  test('uses 120s timeout for thinking model requests', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<GeminiApiFetch>(async (_url, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return okResponse();
    });

    const client = new GeminiApiClient({
      provider: createMockProvider(),
      fetchImpl: fetchMock,
      retry: { maxRetries: 0 },
    });

    const input: GeminiGenerateContentRequest = {
      model: 'gemini-2.5-pro-thinking',
      contents: CONTENTS,
    };

    await client.generateContent(input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);
  });
});
