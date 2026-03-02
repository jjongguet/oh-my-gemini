import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoRoot, runCommand } from '../utils/runtime.js';

const consumerContractScript = path.join(repoRoot, 'scripts', 'consumer-contract-smoke.sh');
const globalInstallContractScript = path.join(
  repoRoot,
  'scripts',
  'global-install-contract-smoke.sh',
);
const packageJsonPath = path.join(repoRoot, 'package.json');
const ciWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');
const releaseWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');

const shouldRunLiveContractGate = process.env.OMG_RUN_GLOBAL_INSTALL_CONTRACT_SMOKE === '1';

describe('integration: global install contract gate wiring', () => {
  test('required contract scripts exist', () => {
    expect(existsSync(consumerContractScript)).toBe(true);
    expect(existsSync(globalInstallContractScript)).toBe(true);
  });

  test('package scripts expose one canonical global install contract gate', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const scripts = packageJson.scripts ?? {};
    expect(scripts['gate:global-install-contract']).toBe(
      'npm run gate:consumer-contract && bash scripts/global-install-contract-smoke.sh',
    );
    expect(scripts['gate:publish']).toContain('gate:global-install-contract');
  });

  test('ci and release workflows use the canonical global install contract gate command', () => {
    const ciWorkflow = readFileSync(ciWorkflowPath, 'utf8');
    const releaseWorkflow = readFileSync(releaseWorkflowPath, 'utf8');

    expect(ciWorkflow).toContain('run: npm run gate:global-install-contract');
    expect(releaseWorkflow).toContain('run: npm run gate:global-install-contract');
    expect(ciWorkflow).not.toContain('run: npm run gate:consumer-contract');
    expect(releaseWorkflow).not.toContain('run: npm run gate:consumer-contract');
  });

  test.runIf(shouldRunLiveContractGate)(
    'global install contract gate executes successfully',
    () => {
      const result = runCommand('npm', ['run', 'gate:global-install-contract'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CI: '1',
        },
        timeout: 420_000,
      });

      expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    },
  );

  test.skipIf(shouldRunLiveContractGate)(
    'set OMG_RUN_GLOBAL_INSTALL_CONTRACT_SMOKE=1 to run the live global install contract gate',
    () => {
      expect(true).toBe(true);
    },
  );
});
