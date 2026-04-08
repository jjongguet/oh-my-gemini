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
const legacyBypassPolicyScript = path.join(repoRoot, 'scripts', 'legacy-bypass-policy.sh');
const packageJsonPath = path.join(repoRoot, 'package.json');
const ciWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');
const releaseWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');

const shouldRunLiveContractGate = process.env.OMP_RUN_GLOBAL_INSTALL_CONTRACT_SMOKE === '1';

describe('integration: global install contract gate wiring', () => {
  test('required contract scripts exist', () => {
    expect(existsSync(consumerContractScript)).toBe(true);
    expect(existsSync(globalInstallContractScript)).toBe(true);
    expect(existsSync(legacyBypassPolicyScript)).toBe(true);
  });

  test('package scripts expose one canonical global install contract gate', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const scripts = packageJson.scripts ?? {};
    const globalInstallContractGateScript = scripts['gate:global-install-contract'];
    expect(globalInstallContractGateScript).toBeDefined();
    expect(globalInstallContractGateScript).toContain('gate:consumer-contract');
    expect(globalInstallContractGateScript).toContain(
      'scripts/global-install-contract-smoke.sh',
    );
    expect(scripts['gate:publish']).toContain('gate:global-install-contract');
    expect(scripts['gate:legacy-bypass']).toContain('scripts/legacy-bypass-policy.sh');
    expect(scripts['gate:3']).toContain('gate:legacy-bypass');
  });

  test('ci workflow uses the canonical global install contract gate command', () => {
    const ciWorkflow = readFileSync(ciWorkflowPath, 'utf8');

    expect(ciWorkflow).toContain('run: npm run gate:global-install-contract');
    expect(ciWorkflow).toContain('run: npm run gate:legacy-bypass');
    expect(ciWorkflow).not.toContain('run: npm run gate:consumer-contract');
  });

  test('release workflow triggers via manual dispatch and publishes via npm', () => {
    const releaseWorkflow = readFileSync(releaseWorkflowPath, 'utf8');

    // release is manual dispatch: merge dev → main, then publish
    expect(releaseWorkflow).toContain('workflow_dispatch');
    expect(releaseWorkflow).toContain('run: npm publish');
  });

  test('legacy bypass policy gate blocks enabled compatibility toggles', () => {
    const pass = runCommand('bash', [legacyBypassPolicyScript], {
      cwd: repoRoot,
      env: {
        ...process.env,
        OMP_LEGACY_RUNNING_SUCCESS: '0',
        OMP_LEGACY_VERIFY_GATE_PASS: '0',
      },
    });
    expect(pass.status, [pass.stderr, pass.stdout].join('\n')).toBe(0);

    const fail = runCommand('bash', [legacyBypassPolicyScript], {
      cwd: repoRoot,
      env: {
        ...process.env,
        OMP_LEGACY_RUNNING_SUCCESS: '1',
      },
    });
    expect(fail.status).toBe(1);
    expect([fail.stderr, fail.stdout].join('\n')).toContain('OMP_LEGACY_RUNNING_SUCCESS=1');
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
    'set OMP_RUN_GLOBAL_INSTALL_CONTRACT_SMOKE=1 to run the live global install contract gate',
    () => {
      expect(true).toBe(true);
    },
  );
});
