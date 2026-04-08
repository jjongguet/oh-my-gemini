import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  commandExists,
  expandCommand,
  expandCommandPrompt,
  getAllCommands,
  getCommand,
  listCommands,
} from '../../src/commands/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

async function writeCommandFixture(extensionRoot: string): Promise<void> {
  await fs.mkdir(path.join(extensionRoot, 'commands', 'team'), { recursive: true });
  await fs.writeFile(
    path.join(extensionRoot, 'gemini-extension.json'),
    `${JSON.stringify({
      name: 'fixture',
      version: '0.0.0',
      description: 'fixture',
      contextFileName: 'GEMINI.md',
    }, null, 2)}\n`,
    'utf8',
  );

  await fs.writeFile(
    path.join(extensionRoot, 'commands', 'setup.toml'),
    [
      'description = "Run setup flow"',
      'prompt = """',
      'Run setup with {{args}}',
      '"""',
      '',
    ].join('\n'),
    'utf8',
  );

  await fs.writeFile(
    path.join(extensionRoot, 'commands', 'team', 'run.toml'),
    [
      'description = "Run team flow"',
      'prompt = """',
      'Run team task: {{ args }}',
      '"""',
      '',
    ].join('\n'),
    'utf8',
  );
}

describe('reliability: feature commands module', () => {
  test('loads and expands extension command templates', async () => {
    const tempRoot = createTempDir('omp-feature-commands-');
    const extensionRoot = path.join(tempRoot, 'fixture-extension');

    try {
      await writeCommandFixture(extensionRoot);
      const options = {
        cwd: tempRoot,
        overridePath: extensionRoot,
      };

      const command = await getCommand('team/run', options);
      expect(command?.description).toBe('Run team flow');
      expect(command?.template).toContain('{{ args }}');

      const expanded = await expandCommand('team/run', 'smoke-task', options);
      expect(expanded?.prompt).toContain('smoke-task');

      const expandedPrompt = await expandCommandPrompt('setup', '--scope project', options);
      expect(expandedPrompt).toContain('--scope project');
      expect(await commandExists('setup', options)).toBe(true);
      expect(await commandExists('missing', options)).toBe(false);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('lists commands recursively in stable sorted order', async () => {
    const tempRoot = createTempDir('omp-feature-commands-list-');
    const extensionRoot = path.join(tempRoot, 'fixture-extension');

    try {
      await writeCommandFixture(extensionRoot);
      const options = {
        cwd: tempRoot,
        overridePath: extensionRoot,
      };

      const names = await listCommands(options);
      expect(names).toEqual(['setup', 'team/run']);

      const commands = await getAllCommands(options);
      expect(commands.map((entry) => entry.name)).toEqual(['setup', 'team/run']);
    } finally {
      removeDir(tempRoot);
    }
  });
});
