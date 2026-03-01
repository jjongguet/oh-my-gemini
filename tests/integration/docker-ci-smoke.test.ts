import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { hasCommand, repoRoot, runCommand } from '../utils/runtime.js';

const dockerScript = path.join(repoRoot, 'scripts', 'docker-ci-smoke.sh');
const dockerKeepScript = path.join(repoRoot, 'scripts', 'docker-ci-keep.sh');
const dockerFullScript = path.join(repoRoot, 'scripts', 'docker-ci-full.sh');
const dockerSmokeRequested = process.env.OMG_RUN_DOCKER_SMOKE === '1';
const dockerFullSmokeRequested = process.env.OMG_RUN_DOCKER_FULL_SMOKE === '1';
const hasGeminiAuth =
  Boolean(process.env.GEMINI_API_KEY) || Boolean(process.env.GOOGLE_API_KEY);
const shouldRunDockerSmoke =
  dockerSmokeRequested &&
  existsSync(dockerScript) &&
  hasCommand('docker');
const shouldRunDockerFullSmoke =
  dockerFullSmokeRequested &&
  hasGeminiAuth &&
  existsSync(dockerFullScript) &&
  hasCommand('docker');

describe('integration: docker ci smoke', () => {
  test('docker ci smoke script scaffold exists', () => {
    expect(existsSync(dockerScript)).toBe(true);
  });

  test('docker keep script scaffold exists', () => {
    expect(existsSync(dockerKeepScript)).toBe(true);
  });

  test('docker full script scaffold exists', () => {
    expect(existsSync(dockerFullScript)).toBe(true);
  });

  test.runIf(shouldRunDockerSmoke)(
    'docker ci smoke script runs successfully',
    () => {
      const result = runCommand(
        'bash',
        [dockerScript, '--task', 'docker-ci-integration-smoke'],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            CI: '1',
          },
          timeout: 1_200_000,
        },
      );

      expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    },
  );

  test.skipIf(shouldRunDockerSmoke)(
    'set OMG_RUN_DOCKER_SMOKE=1 (with docker available) to run this test',
    () => {
      expect(true).toBe(true);
    },
  );

  test.runIf(shouldRunDockerFullSmoke)(
    'docker ci full script runs successfully',
    () => {
      const result = runCommand(
        'bash',
        [
          dockerFullScript,
          '--task',
          'docker-ci-integration-full-smoke',
          '--prompt',
          'Reply with the exact token docker-full-smoke-test-ok',
          '--expected-token',
          'docker-full-smoke-test-ok',
        ],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            CI: '1',
          },
          timeout: 1_500_000,
        },
      );

      expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    },
  );

  test.skipIf(shouldRunDockerFullSmoke)(
    'set OMG_RUN_DOCKER_FULL_SMOKE=1 with GEMINI_API_KEY (or GOOGLE_API_KEY) and docker to run full live smoke',
    () => {
      expect(true).toBe(true);
    },
  );
});
