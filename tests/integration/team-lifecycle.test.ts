import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { cliEntrypointExists, hasCommand, repoRoot, runCommand } from '../utils/runtime.js';

const integrationScript = path.join(repoRoot, 'scripts', 'integration-team-run.sh');
const liveIntegrationRequested = process.env.OMG_RUN_LIVE_INTEGRATION === '1';
const shouldRunIntegration =
  liveIntegrationRequested &&
  existsSync(integrationScript) &&
  cliEntrypointExists() &&
  hasCommand('tmux');

describe('integration: team lifecycle', () => {
  test('integration team-run script scaffold exists', () => {
    expect(existsSync(integrationScript)).toBe(true);
  });

  test.runIf(shouldRunIntegration)(
    'team lifecycle integration script runs successfully',
    () => {
      const result = runCommand('bash', [integrationScript], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CI: '1'
        },
        timeout: 240_000
      });

      expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    }
  );

  test.skipIf(shouldRunIntegration)(
    'set OMG_RUN_LIVE_INTEGRATION=1 (with tmux + CLI + script available) to run this test',
    () => {
      expect(true).toBe(true);
    }
  );
});
