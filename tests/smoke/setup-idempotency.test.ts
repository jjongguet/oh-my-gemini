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
  '.gemini/GEMINI.md',
  '.gemini/sandbox.Dockerfile',
  '.gemini/agents/catalog.json',
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
        expect(firstRun.stdout).toContain('Changes applied: yes');
        expect(firstRun.stdout).toContain(
          'Action statuses: created=5, updated=0, unchanged=0, skipped=0'
        );
        expect(firstRun.stdout).toContain('[created] persist-scope');
        expect(firstRun.stdout).toContain('[created] gemini-managed-note');
        expect(firstRun.stdout).toContain('[created] subagents-catalog');

        const snapshotAfterFirstRun = await readTrackedFiles(
          sandboxProject,
          trackedSetupFiles
        );

        expect(Object.keys(snapshotAfterFirstRun).length).toBeGreaterThan(0);
        const settings = JSON.parse(snapshotAfterFirstRun['.gemini/settings.json'] ?? '{}') as {
          mcpServers?: Record<string, { command?: string; args?: string[] }>;
        };
        expect(settings.mcpServers?.omg_cli_tools).toBeDefined();
        expect(settings.mcpServers?.omg_cli_tools?.command).toBe('oh-my-gemini');
        expect(settings.mcpServers?.omg_cli_tools?.args).toStrictEqual(['tools', 'serve']);

        const secondRun = runOmg(['setup', '--scope', 'project'], {
          cwd: sandboxProject
        });

        expect(secondRun.status, [secondRun.stderr, secondRun.stdout].join('\n')).toBe(0);
        expect(secondRun.stdout).toContain('Changes applied: no');
        expect(secondRun.stdout).toContain(
          'Action statuses: created=0, updated=0, unchanged=5, skipped=0'
        );
        expect(secondRun.stdout).toContain('[unchanged] persist-scope');
        expect(secondRun.stdout).toContain('[unchanged] gemini-settings');
        expect(secondRun.stdout).toContain('[unchanged] subagents-catalog');

        const snapshotAfterSecondRun = await readTrackedFiles(
          sandboxProject,
          trackedSetupFiles
        );

        expect(snapshotAfterSecondRun).toStrictEqual(snapshotAfterFirstRun);

        const dryRun = runOmg(['setup', '--scope', 'user', '--dry-run'], {
          cwd: sandboxProject
        });

        expect(dryRun.status, [dryRun.stderr, dryRun.stdout].join('\n')).toBe(0);
        expect(dryRun.stdout).toContain('Changes applied: no');
        expect(dryRun.stdout).toContain(
          'Action statuses: created=0, updated=0, unchanged=3, skipped=2'
        );
        expect(dryRun.stdout).toContain(
          '[skipped] persist-scope'
        );
        expect(dryRun.stdout).toContain(
          '[skipped] gemini-managed-note'
        );

        const snapshotAfterDryRun = await readTrackedFiles(
          sandboxProject,
          trackedSetupFiles
        );

        expect(snapshotAfterDryRun).toStrictEqual(snapshotAfterSecondRun);
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
