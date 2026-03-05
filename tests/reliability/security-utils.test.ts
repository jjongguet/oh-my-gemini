import { describe, expect, test } from 'vitest';

import {
  validateApiKey,
  validatePathSafe,
  validateShellSafe,
  validateTaskId,
  validateTeamName,
  validateWorkerCount,
} from '../../src/utils/security.js';

describe('reliability: security utility validators', () => {
  test('validateShellSafe accepts plain alphanumeric tokens', () => {
    expect(() => validateShellSafe('worker-1_task', 'worker arg')).not.toThrow();
  });

  test('validateShellSafe rejects metacharacters and empty inputs', () => {
    expect(() => validateShellSafe('', 'worker arg')).toThrow(
      /worker arg: input must be a non-empty string/i,
    );
    expect(() => validateShellSafe('worker; rm -rf /', 'worker arg')).toThrow(
      /worker arg: contains invalid characters/i,
    );
  });

  test('validatePathSafe resolves safe paths and blocks traversal/null-bytes', () => {
    const resolved = validatePathSafe('./tests/reliability', 'path arg');
    expect(resolved).toContain('/tests/reliability');

    expect(() => validatePathSafe('../escape', 'path arg')).toThrow(
      /path arg: path traversal detected/i,
    );
    expect(() => validatePathSafe('valid\0path', 'path arg')).toThrow(
      /path arg: null bytes detected/i,
    );
  });

  test('validateTeamName enforces allowed characters and length', () => {
    expect(() => validateTeamName('team_01-alpha')).not.toThrow();
    expect(() => validateTeamName('team name with spaces')).toThrow(
      /contains invalid characters/i,
    );
    expect(() => validateTeamName('x'.repeat(65))).toThrow(/too long/i);
  });

  test('validateTaskId enforces size and shell-safe constraints', () => {
    expect(() => validateTaskId('task-123')).not.toThrow();
    expect(() => validateTaskId('task|pipe')).toThrow(/contains invalid characters/i);
    expect(() => validateTaskId('x'.repeat(129))).toThrow(/too long/i);
  });

  test('validateWorkerCount requires integer range [1, 32]', () => {
    expect(() => validateWorkerCount(1)).not.toThrow();
    expect(() => validateWorkerCount(32)).not.toThrow();
    expect(() => validateWorkerCount(0)).toThrow(/between 1 and 32/i);
    expect(() => validateWorkerCount(33)).toThrow(/between 1 and 32/i);
    expect(() => validateWorkerCount(2.5)).toThrow(/between 1 and 32/i);
  });

  test('validateApiKey enforces minimum length and shell safety', () => {
    expect(() => validateApiKey('abcdEF123456')).not.toThrow();
    expect(() => validateApiKey('short')).toThrow(/too short/i);
    expect(() => validateApiKey('validBut$unsafeKey')).toThrow(
      /contains invalid characters/i,
    );
  });
});
