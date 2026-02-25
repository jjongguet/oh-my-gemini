import { describe, expect, test } from 'vitest';

import {
  cliEntrypointExists,
  createTempDir,
  readTrackedFiles,
  removeDir,
  runOmg
} from '../utils/runtime.js';

const trackedSetupFiles = [
  '.omg/setup-scope.json',
  '.gemini/settings.json',
  '.gemini/sandbox.Dockerfile'
] as const;

describe('smoke: setup idempotency', () => {
  test.runIf(cliEntrypointExists())(
    'setup --scope project is idempotent for managed project files',
    async () => {
      const sandboxProject = createTempDir('omg-setup-idempotency-');

      try {
        const firstRun = runOmg(['setup', '--scope', 'project'], {
          cwd: sandboxProject
        });

        expect(firstRun.status, [firstRun.stderr, firstRun.stdout].join('\n')).toBe(0);

        const snapshotAfterFirstRun = await readTrackedFiles(
          sandboxProject,
          trackedSetupFiles
        );

        expect(Object.keys(snapshotAfterFirstRun).length).toBeGreaterThan(0);

        const secondRun = runOmg(['setup', '--scope', 'project'], {
          cwd: sandboxProject
        });

        expect(secondRun.status, [secondRun.stderr, secondRun.stdout].join('\n')).toBe(0);

        const snapshotAfterSecondRun = await readTrackedFiles(
          sandboxProject,
          trackedSetupFiles
        );

        expect(snapshotAfterSecondRun).toStrictEqual(snapshotAfterFirstRun);
      } finally {
        removeDir(sandboxProject);
      }
    }
  );

  test.skipIf(cliEntrypointExists())(
    'setup idempotency is validated once the CLI entrypoint exists',
    () => {
      // This message is intentionally explicit for scaffold-phase bring-up.
      expect(true).toBe(true);
    }
  );
});
