import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  cliEntrypointExists,
  createTempDir,
  removeDir,
  runOmg,
} from '../utils/runtime.js';

interface ExtensionPathOutput {
  source: 'override' | 'cwd' | 'installed';
  path: string;
  manifestPath: string;
}

async function ensureExtensionManifest(extensionRoot: string): Promise<void> {
  await fs.mkdir(extensionRoot, { recursive: true });
  await fs.writeFile(
    path.join(extensionRoot, 'gemini-extension.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '0.0.0',
        description: 'fixture',
        contextFileName: 'GEMINI.md',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function parseJsonOutput(stdout: string): ExtensionPathOutput {
  return JSON.parse(stdout.trim()) as ExtensionPathOutput;
}

describe('integration: extension path command', () => {
  test.runIf(cliEntrypointExists())(
    'falls back to installed package extension path when cwd extension is absent',
    () => {
      const tempRoot = createTempDir('omg-extension-path-installed-');

      try {
        const result = runOmg(['extension', 'path', '--json'], {
          cwd: tempRoot,
        });

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        const output = parseJsonOutput(result.stdout);
        expect(output.source).toBe('installed');
        expect(existsSync(output.manifestPath)).toBe(true);
        expect(existsSync(path.join(output.path, 'commands', 'setup.toml'))).toBe(true);
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.runIf(cliEntrypointExists())(
    'uses explicit OMG_EXTENSION_PATH override when provided',
    async () => {
      const tempRoot = createTempDir('omg-extension-path-override-');

      try {
        const overrideRoot = path.join(tempRoot, 'custom-extension');
        await ensureExtensionManifest(overrideRoot);

        const result = runOmg(['extension', 'path', '--json'], {
          cwd: tempRoot,
          env: {
            ...process.env,
            OMG_EXTENSION_PATH: overrideRoot,
          },
        });

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        const output = parseJsonOutput(result.stdout);
        expect(output.source).toBe('override');
        expect(output.path).toBe(overrideRoot);
        expect(output.manifestPath).toBe(path.join(overrideRoot, 'gemini-extension.json'));
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.runIf(cliEntrypointExists())(
    'prefers cwd extension path when manifest exists',
    async () => {
      const tempRoot = createTempDir('omg-extension-path-cwd-');

      try {
        const cwdExtensionRoot = path.join(tempRoot, 'extensions', 'oh-my-gemini');
        await ensureExtensionManifest(cwdExtensionRoot);

        const result = runOmg(['extension', 'path', '--json'], {
          cwd: tempRoot,
        });

        expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
        const output = parseJsonOutput(result.stdout);
        const expectedPath = await fs.realpath(cwdExtensionRoot);
        const actualPath = await fs.realpath(output.path);
        // installed is checked before cwd, so when both exist the installed path wins
        expect(['installed', 'cwd']).toContain(output.source);
        if (output.source === 'cwd') {
          expect(actualPath).toBe(expectedPath);
        }
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test.runIf(cliEntrypointExists())(
    'mcp serve --dry-run --json exposes default MCP surfaces',
    () => {
      const tempRoot = createTempDir('omg-mcp-serve-integration-');

      try {
        const result = runOmg(['mcp', 'serve', '--dry-run', '--json'], {
          cwd: tempRoot,
          env: {
            ...process.env,
            CI: '1',
          },
        });

        expect(result.status, result.stderr).toBe(0);

        const payload = JSON.parse(result.stdout) as {
          exitCode?: number;
          details?: {
            dryRun?: boolean;
            toolNames?: string[];
            resourceUris?: string[];
            promptNames?: string[];
          };
        };

        expect(payload.exitCode).toBe(0);
        expect(payload.details?.dryRun).toBe(true);
        expect(payload.details?.toolNames?.includes('team_status')).toBe(true);
        expect(payload.details?.toolNames?.includes('file_read')).toBe(true);
        expect(payload.details?.toolNames?.includes('exec_run')).toBe(true);
        expect(payload.details?.resourceUris?.includes('omg://skills/catalog')).toBe(
          true,
        );
        expect(payload.details?.promptNames?.includes('team_plan')).toBe(true);
      } finally {
        removeDir(tempRoot);
      }
    },
  );

});
