import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { hasCommand, repoRoot, runCommand } from '../utils/runtime.js';

const dockerScript = path.join(repoRoot, 'scripts', 'docker-ci-smoke.sh');
const dockerSmokeRequested = process.env.OMG_RUN_DOCKER_SMOKE === '1';
const shouldRunDockerSmoke =
  dockerSmokeRequested &&
  existsSync(dockerScript) &&
  hasCommand('docker');

describe('integration: docker ci smoke', () => {
  test('docker ci smoke script scaffold exists', () => {
    expect(existsSync(dockerScript)).toBe(true);
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
});
