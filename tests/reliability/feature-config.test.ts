import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  BUILTIN_FRONTIER_MODEL,
  getDefaultExternalModels,
  getDefaultTierModels,
  isNonGeminiProvider,
  loadConfig,
} from '../../src/config/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: feature config module', () => {
  test('loads default gemini tier models with env overrides', () => {
    const env = {
      ...process.env,
      OMG_MODEL_LOW: 'gemini-low-custom',
      OMG_MODEL_MEDIUM: 'gemini-medium-custom',
      OMG_MODEL_HIGH: 'gemini-high-custom',
    };

    expect(getDefaultTierModels(env)).toEqual({
      LOW: 'gemini-low-custom',
      MEDIUM: 'gemini-medium-custom',
      HIGH: 'gemini-high-custom',
    });
  });

  test('merges user/project/env config with precedence', async () => {
    const tempRoot = createTempDir('omg-feature-config-');
    const userConfigPath = path.join(tempRoot, 'user-config.jsonc');
    const projectConfigPath = path.join(tempRoot, 'project-config.jsonc');

    try {
      await fs.writeFile(
        userConfigPath,
        `{
          // user defaults
          "features": { "parallelExecution": false },
          "routing": { "defaultTier": "LOW" }
        }\n`,
        'utf8',
      );

      await fs.writeFile(
        projectConfigPath,
        `{
          "features": { "runtimePlugins": false },
          "routing": { "defaultTier": "HIGH" }
        }\n`,
        'utf8',
      );

      const env = {
        ...process.env,
        OMG_ROUTING_DEFAULT_TIER: 'MEDIUM',
      };

      const loaded = loadConfig({
        cwd: tempRoot,
        env,
        configPaths: {
          user: userConfigPath,
          project: projectConfigPath,
        },
      });

      expect(loaded.routing.defaultTier).toBe('MEDIUM');
      expect(loaded.features.parallelExecution).toBe(false);
      expect(loaded.features.runtimePlugins).toBe(false);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('uses centralized external model defaults with frontier fallback', () => {
    const defaults = getDefaultExternalModels({
      ...process.env,
      DEFAULT_FRONTIER_MODEL: 'gpt-5.4',
    });

    expect(defaults.codexModel).toBe('gpt-5.4');
    expect(defaults.geminiModel).toBe('gemini-2.5-flash');
    expect(BUILTIN_FRONTIER_MODEL).toBe('gpt-5.4');
  });

  test('prefers explicit external default env vars over frontier fallback', () => {
    const defaults = getDefaultExternalModels({
      ...process.env,
      DEFAULT_FRONTIER_MODEL: 'gpt-5.4',
      OMG_EXTERNAL_MODELS_DEFAULT_CODEX_MODEL: 'gpt-5.2-codex',
      OMG_EXTERNAL_MODELS_DEFAULT_GEMINI_MODEL: 'gemini-2.5-pro',
    });

    expect(defaults.codexModel).toBe('gpt-5.2-codex');
    expect(defaults.geminiModel).toBe('gemini-2.5-pro');
  });

  test('auto-enables forceInherit for non-gemini base urls', () => {
    const loaded = loadConfig({
      cwd: process.cwd(),
      env: {
        ...process.env,
        GEMINI_BASE_URL: 'https://example-proxy.local/v1',
      },
      configPaths: {
        user: '/__missing__/user.jsonc',
        project: '/__missing__/project.jsonc',
      },
    });

    expect(loaded.routing.forceInherit).toBe(true);
    expect(isNonGeminiProvider({ GEMINI_BASE_URL: 'https://example-proxy.local/v1' })).toBe(
      true,
    );
  });

  test('keeps forceInherit disabled on default gemini endpoints', () => {
    const loaded = loadConfig({
      cwd: process.cwd(),
      env: {
        ...process.env,
        GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com',
      },
      configPaths: {
        user: '/__missing__/user.jsonc',
        project: '/__missing__/project.jsonc',
      },
    });

    expect(loaded.routing.forceInherit).toBe(false);
  });
});
