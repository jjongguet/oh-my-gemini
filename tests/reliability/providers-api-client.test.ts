import { describe, expect, test, vi } from 'vitest';

import {
  GeminiApiClient,
  GeminiApiClientError,
  createGeminiApiClient,
} from '../../src/providers/api-client.js';

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('reliability: Gemini API client abstraction', () => {
  test('generateContent posts request to Google AI endpoint with API key query auth', async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        candidates: [{ content: { parts: [{ text: 'hello back' }] } }],
      }),
    );

    const client = createGeminiApiClient({
      provider: 'google-ai',
      env: {
        GEMINI_API_KEY: 'test-google-key',
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const response = await client.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      systemInstruction: 'be concise',
    });

    expect(response.candidates).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const url = firstCall?.[0];
    const requestInit = firstCall?.[1] as RequestInit | undefined;

    expect(String(url)).toContain('/v1beta/models/gemini-2.5-pro:generateContent');
    expect(String(url)).toContain('key=test-google-key');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({
      'content-type': 'application/json',
    });

    const parsedBody = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
    expect(parsedBody.model).toBeUndefined();
    expect(parsedBody.contents).toStrictEqual([{ role: 'user', parts: [{ text: 'hello' }] }]);
    expect(parsedBody.systemInstruction).toStrictEqual({
      parts: [{ text: 'be concise' }],
    });
  });

  test('generateContent uses Vertex endpoint path and bearer auth header', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({ modelVersion: 'gemini-2.5-pro' }));

    const client = new GeminiApiClient({
      provider: 'vertex-ai',
      env: {
        VERTEX_AI_PROJECT_ID: 'demo-project',
        VERTEX_AI_LOCATION: 'asia-northeast3',
        VERTEX_AI_ACCESS_TOKEN: 'vertex-token',
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await client.generateContent({
      model: 'models/gemini-2.5-pro',
      contents: [{ parts: [{ text: 'ship it' }] }],
    });

    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const url = firstCall?.[0];
    const requestInit = firstCall?.[1] as RequestInit | undefined;

    expect(String(url)).toContain('/v1/projects/demo-project/locations/asia-northeast3/publishers/google/models/gemini-2.5-pro:generateContent');
    expect(requestInit?.headers).toMatchObject({
      Authorization: 'Bearer vertex-token',
      'content-type': 'application/json',
    });
  });

  test('constructor auto-detects provider from environment when omitted', () => {
    const client = new GeminiApiClient({
      env: { GEMINI_API_KEY: 'auto-detect-key' },
      fetchImpl: vi.fn(async () => createJsonResponse({})) as unknown as typeof fetch,
    });

    expect(client.providerName).toBe('google-ai');
  });

  test('throws structured client error on non-2xx response', async () => {
    const fetchMock = vi.fn(async () => new Response('bad request', { status: 400 }));

    const client = new GeminiApiClient({
      provider: 'google-ai',
      env: { GEMINI_API_KEY: 'test-google-key' },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: 'hello' }] }],
      }),
    ).rejects.toMatchObject({
      name: 'GeminiApiClientError',
      provider: 'google-ai',
      statusCode: 400,
      responseBody: 'bad request',
    });
  });

  test('throws when provider cannot be detected from environment', () => {
    expect(
      () =>
        new GeminiApiClient({
          env: {},
          fetchImpl: vi.fn(async () => createJsonResponse({})) as unknown as typeof fetch,
        }),
    ).toThrow(/unable to detect gemini provider/i);
  });
});
