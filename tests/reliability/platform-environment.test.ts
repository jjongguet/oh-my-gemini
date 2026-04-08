import { describe, expect, test } from 'vitest';

import {
  applyEnvironmentOverrides,
  buildRuntimeEnvironment,
  pickEnvironment,
  resolveGeminiApiEnvironment,
} from '../../src/platform/index.js';

describe('reliability: platform environment abstraction', () => {
  test('pickEnvironment selects configured keys and drops invalid entries', () => {
    const picked = pickEnvironment(['PATH', 'UNSAFE-KEY'], {
      PATH: '/usr/bin',
      'UNSAFE-KEY': 'value',
    });

    expect(picked).toStrictEqual({ PATH: '/usr/bin' });
  });

  test('resolveGeminiApiEnvironment mirrors GOOGLE_API_KEY to GEMINI_API_KEY', () => {
    const resolved = resolveGeminiApiEnvironment({
      GOOGLE_API_KEY: 'google-key',
    });

    expect(resolved.GEMINI_API_KEY).toBe('google-key');
    expect(resolved.GOOGLE_API_KEY).toBe('google-key');
  });

  test('resolveGeminiApiEnvironment preserves explicit GEMINI_API_KEY precedence', () => {
    const resolved = resolveGeminiApiEnvironment({
      GEMINI_API_KEY: 'gemini-key',
      GOOGLE_API_KEY: 'google-key',
      GOOGLE_CLOUD_PROJECT: 'proj-1',
    });

    expect(resolved.GEMINI_API_KEY).toBe('gemini-key');
    expect(resolved.GOOGLE_API_KEY).toBe('google-key');
    expect(resolved.GOOGLE_CLOUD_PROJECT).toBe('proj-1');
  });

  test('applyEnvironmentOverrides ignores unsafe keys and trims unsafe chars', () => {
    const output = applyEnvironmentOverrides(
      {
        PATH: '/usr/bin',
      },
      {
        GEMINI_API_KEY: '  abc123\n',
        'BAD-KEY': 'x',
      },
    );

    expect(output).toStrictEqual({
      PATH: '/usr/bin',
      GEMINI_API_KEY: 'abc123',
    });
  });

  test('buildRuntimeEnvironment merges allowlist, gemini vars, and explicit overrides', () => {
    const env = buildRuntimeEnvironment({
      sourceEnv: {
        PATH: '/usr/bin',
        HOME: '/home/tester',
        GOOGLE_API_KEY: 'google-key',
        SECRET_TOKEN: 'hidden',
      },
      overrides: {
        OMP_TEAM_WORKER: 'team/worker-1',
      },
    });

    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/tester');
    expect(env.GEMINI_API_KEY).toBe('google-key');
    expect(env.GOOGLE_API_KEY).toBe('google-key');
    expect(env.OMP_TEAM_WORKER).toBe('team/worker-1');
    expect(env.SECRET_TOKEN).toBeUndefined();
  });

  test('buildRuntimeEnvironment can disable Gemini propagation', () => {
    const env = buildRuntimeEnvironment({
      sourceEnv: {
        GOOGLE_API_KEY: 'google-key',
      },
      includeKeys: [],
      includeGeminiApi: false,
    });

    expect(env).toStrictEqual({});
  });
});
