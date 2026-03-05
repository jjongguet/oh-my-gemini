import { describe, expect, test } from 'vitest';

import { commands, config, platform } from '../../src/features/index.js';

describe('reliability: feature system index', () => {
  test('re-exports commands, config, and platform modules', () => {
    expect(typeof commands.getCommand).toBe('function');
    expect(typeof config.loadConfig).toBe('function');
    expect(typeof platform.isProcessAlive).toBe('function');
  });
});
