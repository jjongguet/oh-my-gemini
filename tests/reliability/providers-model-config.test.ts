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
  test('exposes built-in default tier map per provider', () => {
    expect(getBuiltInTierModelMap('google-ai')).toStrictEqual({
      low: 'gemini-2.5-flash-lite',
      medium: 'gemini-2.5-flash',
      high: 'gemini-2.5-pro',
    });

    expect(getBuiltInTierModelMap('vertex-ai')).toStrictEqual({
      low: 'gemini-2.5-flash-lite',
      medium: 'gemini-2.5-flash',
      high: 'gemini-2.5-pro',
    });
  });

  test('resolveTierModels supports global and provider-specific env overrides', () => {
    const env: NodeJS.ProcessEnv = {
      OMG_GEMINI_MODEL_LOW: 'gemini-global-low',
      OMG_GEMINI_MODEL_VERTEX_AI_HIGH: 'gemini-vertex-high',
    };

    expect(resolveTierModels('google-ai', env)).toStrictEqual({
      low: 'gemini-global-low',
      medium: 'gemini-2.5-flash',
      high: 'gemini-2.5-pro',
    });

    expect(resolveTierModels('vertex-ai', env)).toStrictEqual({
      low: 'gemini-global-low',
      medium: 'gemini-2.5-flash',
      high: 'gemini-vertex-high',
    });
  });

  test('resolveModelForTier returns resolved value for a provider and tier', () => {
    expect(resolveModelForTier('high', 'google-ai', {})).toBe('gemini-2.5-pro');
  });

  test('listModelConfigurations returns provider-scoped and merged catalogs', () => {
    expect(listModelConfigurations('google-ai').every((entry) => entry.provider === 'google-ai')).toBe(
      true,
    );
    expect(listModelConfigurations().length).toBeGreaterThan(
      listModelConfigurations('google-ai').length,
    );
  });

  test('getModelConfiguration normalizes model id prefix/casing', () => {
    const config = getModelConfiguration('models/GEMINI-2.5-PRO', 'google-ai');

    expect(config?.id).toBe('gemini-2.5-pro');
    expect(config?.tier).toBe('high');
  });

  test('isKnownModel and listModelTiers expose deterministic helpers', () => {
    expect(isKnownModel('gemini-2.5-flash', 'vertex-ai')).toBe(true);
    expect(isKnownModel('gemini-unknown', 'vertex-ai')).toBe(false);
    expect(listModelTiers()).toStrictEqual(['low', 'medium', 'high']);
  });
});
