import { describe, expect, test, vi } from 'vitest';

import {
  GeminiApiClient,
  GeminiApiClientError,
  type GeminiApiFetch,
  type GeminiGenerateContentRequest,
} from '../../src/providers/api-client.js';

const VALID_INPUT: GeminiGenerateContentRequest = {
  model: 'gemini-2.5-flash',
  contents: [{ parts: [{ text: 'hello' }] }],
};

const SUCCESS_BODY = JSON.stringify({
  candidates: [{ content: { parts: [{ text: 'hi' }] } }],
});

function okResponse(body: string = SUCCESS_BODY): Response {
  return new Response(body, { status: 200, statusText: 'OK' });
}

function errorResponse(
  status: number,
  statusText: string,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: { message: 'fail' } }), {
    status,
    statusText,
    headers,
  });
}

function createClient(
  fetchImpl: GeminiApiFetch,
  retryOpts?: { maxRetries?: number; initialDelayMs?: number; maxDelayMs?: number },
): GeminiApiClient {
  return new GeminiApiClient({
    provider: {
      name: 'google-ai',
      displayName: 'Google AI',
      aliases: [],
      defaultApiVersion: 'v1beta',
      detectFromEnv: () => true,
      checkAuth: () => true,
      resolveConfig: () => ({
        provider: 'google-ai' as const,
        apiVersion: 'v1beta',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'test-key',
      }),
      buildGenerateContentUrl: (model) =>
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      buildRequestHeaders: () => ({
        'x-goog-api-key': 'test-key',
      }),
    },
    fetchImpl,
    retry: {
      maxRetries: retryOpts?.maxRetries ?? 3,
      initialDelayMs: retryOpts?.initialDelayMs ?? 1,
      maxDelayMs: retryOpts?.maxDelayMs ?? 10,
    },
  });
}

describe('reliability: api-client retry with exponential backoff', () => {
  test('succeeds on first attempt without retry', async () => {
    const fetchMock = vi.fn<GeminiApiFetch>().mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock);
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.candidates).toBeDefined();
  });

  test('retries on 429 and succeeds', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock);
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
  });

  test('retries on 500 server error and succeeds', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock);
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
  });

  test('retries on 503 service unavailable and succeeds', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock);
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
  });

  test('does not retry on 400 client error', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(400, 'Bad Request'));

    const client = createClient(fetchMock);

    await expect(client.generateContent(VALID_INPUT)).rejects.toThrow(GeminiApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not retry on 401 unauthorized', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));

    const client = createClient(fetchMock);

    await expect(client.generateContent(VALID_INPUT)).rejects.toThrow(GeminiApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not retry on 403 forbidden', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(403, 'Forbidden'));

    const client = createClient(fetchMock);

    await expect(client.generateContent(VALID_INPUT)).rejects.toThrow(GeminiApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('exhausts all retries then throws last error', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockImplementation(() => Promise.resolve(errorResponse(500, 'Internal Server Error')));

    const client = createClient(fetchMock, { maxRetries: 2 });

    const error = await client.generateContent(VALID_INPUT).catch((e) => e);
    expect(error).toBeInstanceOf(GeminiApiClientError);
    expect(error.statusCode).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  test('retries on network failure and succeeds', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock);
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
  });

  test('exhausts retries on persistent network failure', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockRejectedValue(new TypeError('fetch failed'));

    const client = createClient(fetchMock, { maxRetries: 2 });

    const error = await client.generateContent(VALID_INPUT).catch((e) => e);
    expect(error).toBeInstanceOf(GeminiApiClientError);
    expect(error.message).toContain('failed before receiving a response');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('respects Retry-After header with seconds value', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests', { 'retry-after': '1' }))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock, { initialDelayMs: 1, maxDelayMs: 2000 });

    const start = Date.now();
    const result = await client.generateContent(VALID_INPUT);
    const elapsed = Date.now() - start;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
    // Retry-After: 1 means wait ~1000ms; allow generous tolerance
    expect(elapsed).toBeGreaterThanOrEqual(800);
  });

  test('clamps Retry-After to maxDelayMs', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests', { 'retry-after': '60' }))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock, { initialDelayMs: 1, maxDelayMs: 50 });

    const start = Date.now();
    const result = await client.generateContent(VALID_INPUT);
    const elapsed = Date.now() - start;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
    // maxDelayMs is 50ms, so should not wait 60s
    expect(elapsed).toBeLessThan(500);
  });

  test('maxRetries=0 disables retry', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));

    const client = createClient(fetchMock, { maxRetries: 0 });

    await expect(client.generateContent(VALID_INPUT)).rejects.toThrow(GeminiApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('multiple retries before success', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'))
      .mockResolvedValueOnce(errorResponse(502, 'Bad Gateway'))
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock, { maxRetries: 3 });
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.candidates).toBeDefined();
  });

  test('mixed network and server errors before success', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(okResponse());

    const client = createClient(fetchMock, { maxRetries: 3 });
    const result = await client.generateContent(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.candidates).toBeDefined();
  });

  test('preserves error details from last failed attempt', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'));

    const client = createClient(fetchMock, { maxRetries: 1 });

    const error = await client.generateContent(VALID_INPUT).catch((e) => e);
    expect(error).toBeInstanceOf(GeminiApiClientError);
    expect(error.statusCode).toBe(503);
    expect(error.message).toContain('503');
  });

  test('uses default retry config when not specified', () => {
    const client = new GeminiApiClient({
      provider: {
        name: 'google-ai',
        displayName: 'Google AI',
        aliases: [],
        defaultApiVersion: 'v1beta',
        detectFromEnv: () => true,
        checkAuth: () => true,
        resolveConfig: () => ({
          provider: 'google-ai' as const,
          apiVersion: 'v1beta',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: 'test-key',
        }),
        buildGenerateContentUrl: () => 'https://example.com',
        buildRequestHeaders: () => ({}),
      },
    });

    // Verify client was created successfully with defaults (no throw)
    expect(client.providerName).toBe('google-ai');
  });
});
