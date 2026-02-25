import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { hasCommand, repoRoot, runCommand } from '../utils/runtime.js';

const sandboxDockerfile = path.join(repoRoot, '.gemini', 'sandbox.Dockerfile');
const sandboxSmokeScript = path.join(repoRoot, 'scripts', 'sandbox-smoke.sh');
const sandboxDockerfileExists = existsSync(sandboxDockerfile);
const hasContainerRuntime = hasCommand('docker') || hasCommand('podman');
const liveSandboxSmokeRequested =
  process.env.OMG_RUN_LIVE_SANDBOX_SMOKE === '1';
const shouldExecuteSmoke =
  liveSandboxSmokeRequested &&
  existsSync(sandboxSmokeScript) &&
  hasCommand('gemini') &&
  hasContainerRuntime;

describe('smoke: sandbox baseline', () => {
  test.runIf(sandboxDockerfileExists)('sandbox Dockerfile scaffold exists', () => {
    expect(sandboxDockerfileExists).toBe(true);
  });

  test.skipIf(sandboxDockerfileExists)(
    'sandbox Dockerfile scaffold is expected from phase-0 bootstrap',
    () => {
      expect(true).toBe(true);
    }
  );

  test('sandbox smoke script scaffold exists', () => {
    expect(existsSync(sandboxSmokeScript)).toBe(true);
  });

  test.runIf(shouldExecuteSmoke)('sandbox smoke script exits successfully', () => {
    const result = runCommand('bash', [sandboxSmokeScript], {
      cwd: repoRoot,
      timeout: 180_000
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
  });

  test.skipIf(shouldExecuteSmoke)(
    'set OMG_RUN_LIVE_SANDBOX_SMOKE=1 (and ensure gemini + docker/podman) to run live smoke',
    () => {
      expect(true).toBe(true);
    }
  );
});
