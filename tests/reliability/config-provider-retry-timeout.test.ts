import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { loadConfig, loadEnvConfig } from '../../src/config/index.js';
import {
  GeminiApiClient,
  type GeminiApiFetch,
  type GeminiGenerateContentRequest,
  createGeminiApiClientFromConfig,
} from '../../src/providers/api-client.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

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

describe('config: retry/timeout fields in OmpGeminiProviderConfig', () => {
  test('default config does not include retry or requestTimeoutMs', () => {
    const config = loadConfig({
      env: { GEMINI_API_KEY: 'test-key' },
      configPaths: { user: '/nonexistent/user.jsonc', project: '/nonexistent/project.jsonc' },
    });

    expect(config.providers.gemini.requestTimeoutMs).toBeUndefined();
    expect(config.providers.gemini.retry).toBeUndefined();
  });

  test('JSONC config file sets retry and requestTimeoutMs', async () => {
    const tempRoot = createTempDir('omp-retry-timeout-');
    const projectConfig = path.join(tempRoot, 'project.jsonc');

    try {
      await fs.writeFile(
        projectConfig,
        `{
          "providers": {
            "gemini": {
              "requestTimeoutMs": 45000,
              "retry": {
                "maxRetries": 5,
                "initialDelayMs": 2000,
                "maxDelayMs": 60000
              }
            }
          }
        }\n`,
        'utf8',
      );

      const config = loadConfig({
        cwd: tempRoot,
        env: { GEMINI_API_KEY: 'test-key' },
        configPaths: { user: '/nonexistent/user.jsonc', project: projectConfig },
      });

      expect(config.providers.gemini.requestTimeoutMs).toBe(45000);
      expect(config.providers.gemini.retry).toEqual({
        maxRetries: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
      });
    } finally {
      removeDir(tempRoot);
    }
  });

  test('partial retry config merges correctly', async () => {
    const tempRoot = createTempDir('omp-retry-partial-');
    const projectConfig = path.join(tempRoot, 'project.jsonc');

    try {
      await fs.writeFile(
        projectConfig,
        `{
          "providers": {
            "gemini": {
              "retry": { "maxRetries": 10 }
            }
          }
        }\n`,
        'utf8',
      );

      const config = loadConfig({
        cwd: tempRoot,
        env: { GEMINI_API_KEY: 'test-key' },
        configPaths: { user: '/nonexistent/user.jsonc', project: projectConfig },
      });

      expect(config.providers.gemini.retry).toEqual({ maxRetries: 10 });
    } finally {
      removeDir(tempRoot);
    }
  });
});

describe('config: env var overrides for retry/timeout', () => {
  test('OMP_REQUEST_TIMEOUT_MS sets requestTimeoutMs in provider config', () => {
    const envConfig = loadEnvConfig({
      OMP_REQUEST_TIMEOUT_MS: '90000',
    });

    expect(envConfig.providers?.gemini.requestTimeoutMs).toBe(90000);
  });

  test('GEMINI_REQUEST_TIMEOUT_MS sets requestTimeoutMs when OMP variant absent', () => {
    const envConfig = loadEnvConfig({
      GEMINI_REQUEST_TIMEOUT_MS: '45000',
    });

    expect(envConfig.providers?.gemini.requestTimeoutMs).toBe(45000);
  });

  test('OMP_REQUEST_TIMEOUT_MS takes precedence over GEMINI_REQUEST_TIMEOUT_MS', () => {
    const envConfig = loadEnvConfig({
      OMP_REQUEST_TIMEOUT_MS: '90000',
      GEMINI_REQUEST_TIMEOUT_MS: '45000',
    });

    expect(envConfig.providers?.gemini.requestTimeoutMs).toBe(90000);
  });

  test('invalid timeout env var is ignored', () => {
    const envConfig = loadEnvConfig({
      OMP_REQUEST_TIMEOUT_MS: 'not-a-number',
    });

    expect(envConfig.providers?.gemini.requestTimeoutMs).toBeUndefined();
  });

  test('negative timeout env var is ignored', () => {
    const envConfig = loadEnvConfig({
      OMP_REQUEST_TIMEOUT_MS: '-5000',
    });

    expect(envConfig.providers?.gemini.requestTimeoutMs).toBeUndefined();
  });

  test('OMP_RETRY_MAX_RETRIES sets retry.maxRetries', () => {
    const envConfig = loadEnvConfig({
      OMP_RETRY_MAX_RETRIES: '5',
    });

    expect(envConfig.providers?.gemini.retry?.maxRetries).toBe(5);
  });

  test('OMP_RETRY_INITIAL_DELAY_MS sets retry.initialDelayMs', () => {
    const envConfig = loadEnvConfig({
      OMP_RETRY_INITIAL_DELAY_MS: '2000',
    });

    expect(envConfig.providers?.gemini.retry?.initialDelayMs).toBe(2000);
  });

  test('OMP_RETRY_MAX_DELAY_MS sets retry.maxDelayMs', () => {
    const envConfig = loadEnvConfig({
      OMP_RETRY_MAX_DELAY_MS: '60000',
    });

    expect(envConfig.providers?.gemini.retry?.maxDelayMs).toBe(60000);
  });

  test('all retry env vars set together', () => {
    const envConfig = loadEnvConfig({
      OMP_RETRY_MAX_RETRIES: '7',
      OMP_RETRY_INITIAL_DELAY_MS: '500',
      OMP_RETRY_MAX_DELAY_MS: '15000',
    });

    expect(envConfig.providers?.gemini.retry).toEqual({
      maxRetries: 7,
      initialDelayMs: 500,
      maxDelayMs: 15000,
    });
  });

  test('invalid retry env vars are ignored', () => {
    const envConfig = loadEnvConfig({
      OMP_RETRY_MAX_RETRIES: 'abc',
      OMP_RETRY_INITIAL_DELAY_MS: '-100',
    });

    // Invalid values produce no retry block, but providers block still exists
    // because the env keys trigger the guard condition
    expect(envConfig.providers?.gemini.retry).toBeUndefined();
  });

  test('OMP_RETRY_MAX_RETRIES=0 is valid (disables retry)', () => {
    const envConfig = loadEnvConfig({
      OMP_RETRY_MAX_RETRIES: '0',
    });

    expect(envConfig.providers?.gemini.retry?.maxRetries).toBe(0);
  });
});

describe('config: env overrides take precedence over file config', () => {
  test('env timeout overrides file timeout', async () => {
    const tempRoot = createTempDir('omp-retry-precedence-');
    const projectConfig = path.join(tempRoot, 'project.jsonc');

    try {
      await fs.writeFile(
        projectConfig,
        `{
          "providers": {
            "gemini": {
              "requestTimeoutMs": 45000,
              "retry": { "maxRetries": 3 }
            }
          }
        }\n`,
        'utf8',
      );

      const config = loadConfig({
        cwd: tempRoot,
        env: {
          GEMINI_API_KEY: 'test-key',
          OMP_REQUEST_TIMEOUT_MS: '90000',
          OMP_RETRY_MAX_RETRIES: '10',
        },
        configPaths: { user: '/nonexistent/user.jsonc', project: projectConfig },
      });

      // Env vars produce a providers block that deep-merges over file config
      expect(config.providers.gemini.requestTimeoutMs).toBe(90000);
      expect(config.providers.gemini.retry?.maxRetries).toBe(10);
    } finally {
      removeDir(tempRoot);
    }
  });
});

describe('config: createGeminiApiClientFromConfig wiring', () => {
  test('creates client with retry and timeout from config', () => {
    const client = createGeminiApiClientFromConfig(
      {
        enabled: true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultModel: 'gemini-3-flash',
        requestTimeoutMs: 60000,
        retry: {
          maxRetries: 5,
          initialDelayMs: 2000,
          maxDelayMs: 60000,
        },
      },
      { provider: createMockProvider() },
    );

    expect(client.resolveRequestTimeoutMs('gemini-3-flash')).toBe(60000);
    expect(client.providerName).toBe('google-ai');
  });

  test('config timeout overrides model-aware defaults', () => {
    const client = createGeminiApiClientFromConfig(
      {
        enabled: true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultModel: 'gemini-3-flash',
        requestTimeoutMs: 15000,
      },
      { provider: createMockProvider() },
    );

    // Even for a thinking model, explicit config wins
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(15000);
  });

  test('config without timeout falls back to model-aware defaults', () => {
    const client = createGeminiApiClientFromConfig(
      {
        enabled: true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultModel: 'gemini-3-flash',
      },
      { provider: createMockProvider() },
    );

    expect(client.resolveRequestTimeoutMs('gemini-3-flash')).toBe(30000);
    expect(client.resolveRequestTimeoutMs('gemini-2.5-pro-thinking')).toBe(120000);
  });

  test('config retry wires to client behavior', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'fail' } }), {
          status: 503,
          statusText: 'Service Unavailable',
        }),
      )
      .mockResolvedValueOnce(okResponse());

    const client = createGeminiApiClientFromConfig(
      {
        enabled: true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultModel: 'gemini-3-flash',
        retry: {
          maxRetries: 2,
          initialDelayMs: 1,
          maxDelayMs: 10,
        },
      },
      { provider: createMockProvider(), fetchImpl: fetchMock },
    );

    const input: GeminiGenerateContentRequest = {
      model: 'gemini-3-flash',
      contents: [{ parts: [{ text: 'hello' }] }],
    };

    const result = await client.generateContent(input);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toBeDefined();
  });

  test('config maxRetries=0 disables retry via factory', async () => {
    const fetchMock = vi
      .fn<GeminiApiFetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'fail' } }), {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

    const client = createGeminiApiClientFromConfig(
      {
        enabled: true,
        apiKeyEnvVar: 'GEMINI_API_KEY',
        defaultModel: 'gemini-3-flash',
        retry: { maxRetries: 0 },
      },
      { provider: createMockProvider(), fetchImpl: fetchMock },
    );

    const input: GeminiGenerateContentRequest = {
      model: 'gemini-3-flash',
      contents: [{ parts: [{ text: 'hello' }] }],
    };

    await expect(client.generateContent(input)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
