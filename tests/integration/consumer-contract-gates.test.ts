import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoRoot, runCommand } from '../utils/runtime.js';

const consumerContractScript = path.join(repoRoot, 'scripts', 'consumer-contract-smoke.sh');
const shouldRunLiveConsumerContract = process.env.OMG_RUN_CONSUMER_CONTRACT_SMOKE === '1';

describe('integration: consumer contract gate', () => {
  test('consumer contract smoke script scaffold exists', () => {
    expect(existsSync(consumerContractScript)).toBe(true);
  });

  test.runIf(shouldRunLiveConsumerContract)(
    'consumer contract smoke script executes successfully',
    () => {
      const result = runCommand('bash', [consumerContractScript], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CI: '1',
        },
        timeout: 300_000,
      });

      expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    },
  );

  test.skipIf(shouldRunLiveConsumerContract)(
    'set OMG_RUN_CONSUMER_CONTRACT_SMOKE=1 to run the live consumer-contract smoke',
    () => {
      expect(true).toBe(true);
    },
  );
});
