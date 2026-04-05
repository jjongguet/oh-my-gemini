import { describe, expect, test } from 'vitest';

import {
  getBuiltInTierModelMap,
  getModelConfiguration,
  isKnownModel,
  listModelConfigurations,
  listModelTiers,
  resolveModelForTier,
  resolveTierModels,
} from '../../src/providers/model-config.js';

describe('reliability: provider model configuration', () => {
  test('exposes built-in default tier map per provider with Gemini 3.1 models', () => {
    expect(getBuiltInTierModelMap('google-ai')).toStrictEqual({
      low: 'gemini-3.1-flash-lite-preview',
      medium: 'gemini-3.1-flash-lite-preview',
      high: 'gemini-3.1-pro-preview',
    });

    expect(getBuiltInTierModelMap('vertex-ai')).toStrictEqual({
      low: 'gemini-3.1-flash-lite-preview',
      medium: 'gemini-3.1-flash-lite-preview',
      high: 'gemini-3.1-pro-preview',
    });
  });

  test('resolveTierModels supports global and provider-specific env overrides', () => {
    const env: NodeJS.ProcessEnv = {
      OMG_GEMINI_MODEL_LOW: 'gemini-global-low',
      OMG_GEMINI_MODEL_VERTEX_AI_HIGH: 'gemini-vertex-high',
    };

    expect(resolveTierModels('google-ai', env)).toStrictEqual({
      low: 'gemini-global-low',
      medium: 'gemini-3.1-flash-lite-preview',
      high: 'gemini-3.1-pro-preview',
    });

    expect(resolveTierModels('vertex-ai', env)).toStrictEqual({
      low: 'gemini-global-low',
      medium: 'gemini-3.1-flash-lite-preview',
      high: 'gemini-vertex-high',
    });
  });

  test('env overrides can select Gemini 2.5 models for backward compatibility', () => {
    const env: NodeJS.ProcessEnv = {
      OMG_GEMINI_MODEL_HIGH: 'gemini-2.5-pro',
      OMG_GEMINI_MODEL_MEDIUM: 'gemini-2.5-flash',
      OMG_GEMINI_MODEL_LOW: 'gemini-2.5-flash-lite',
    };

    expect(resolveTierModels('google-ai', env)).toStrictEqual({
      low: 'gemini-2.5-flash-lite',
      medium: 'gemini-2.5-flash',
      high: 'gemini-2.5-pro',
    });
  });

  test('resolveModelForTier returns resolved value for a provider and tier', () => {
    expect(resolveModelForTier('high', 'google-ai', {})).toBe('gemini-3.1-pro-preview');
    expect(resolveModelForTier('medium', 'google-ai', {})).toBe('gemini-3.1-flash-lite-preview');
    expect(resolveModelForTier('low', 'google-ai', {})).toBe('gemini-3.1-flash-lite-preview');
  });

  test('listModelConfigurations returns provider-scoped and merged catalogs', () => {
    expect(listModelConfigurations('google-ai').every((entry) => entry.provider === 'google-ai')).toBe(
      true,
    );
    expect(listModelConfigurations().length).toBeGreaterThan(
      listModelConfigurations('google-ai').length,
    );
  });

  test('listModelConfigurations includes both Gemini 3 and 2.5 models', () => {
    const allModels = listModelConfigurations();
    const modelIds = allModels.map((m) => m.id);

    // Gemini 3 models present
    expect(modelIds).toContain('gemini-3-pro');
    expect(modelIds).toContain('gemini-3-flash');
    expect(modelIds).toContain('gemini-3-flash-lite');

    // Gemini 2.5 models still present for backward compatibility
    expect(modelIds).toContain('gemini-2.5-pro');
    expect(modelIds).toContain('gemini-2.5-flash');
    expect(modelIds).toContain('gemini-2.5-flash-lite');
  });

  test('getModelConfiguration normalizes model id prefix/casing', () => {
    const config = getModelConfiguration('models/GEMINI-3-PRO', 'google-ai');
    expect(config?.id).toBe('gemini-3-pro');
    expect(config?.tier).toBe('high');

    // 2.5 models still resolvable
    const legacy = getModelConfiguration('models/GEMINI-2.5-PRO', 'google-ai');
    expect(legacy?.id).toBe('gemini-2.5-pro');
    expect(legacy?.tier).toBe('high');
  });

  test('Gemini 3 model configurations have correct specs', () => {
    const pro = getModelConfiguration('gemini-3-pro', 'google-ai');
    expect(pro?.contextWindowTokens).toBe(2_097_152);
    expect(pro?.maxOutputTokens).toBe(65_536);
    expect(pro?.supportsVision).toBe(true);

    const flash = getModelConfiguration('gemini-3-flash', 'google-ai');
    expect(flash?.contextWindowTokens).toBe(2_097_152);
    expect(flash?.maxOutputTokens).toBe(65_536);
    expect(flash?.supportsVision).toBe(true);

    const flashLite = getModelConfiguration('gemini-3-flash-lite', 'google-ai');
    expect(flashLite?.contextWindowTokens).toBe(1_048_576);
    expect(flashLite?.maxOutputTokens).toBe(16_384);
    expect(flashLite?.supportsVision).toBe(true);
  });

  test('isKnownModel recognizes both Gemini 3 and 2.5 models', () => {
    // Gemini 3
    expect(isKnownModel('gemini-3-pro', 'google-ai')).toBe(true);
    expect(isKnownModel('gemini-3-flash', 'vertex-ai')).toBe(true);
    expect(isKnownModel('gemini-3-flash-lite', 'vertex-ai')).toBe(true);

    // Gemini 2.5 backward compatibility
    expect(isKnownModel('gemini-2.5-flash', 'vertex-ai')).toBe(true);
    expect(isKnownModel('gemini-2.5-pro', 'google-ai')).toBe(true);

    // Unknown
    expect(isKnownModel('gemini-unknown', 'vertex-ai')).toBe(false);
  });

  test('listModelTiers exposes deterministic tier list', () => {
    expect(listModelTiers()).toStrictEqual(['low', 'medium', 'high']);
  });
});
