import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

describe('smoke: native Gemini extension package layout', () => {
  test('publishes installable extension assets at the package root', () => {
    const manifestPath = path.join(packageRoot, 'gemini-extension.json');
    const contextFilePath = path.join(packageRoot, 'GEMINI.md');
    const commandFiles = [
      path.join(packageRoot, 'commands', 'omp', 'doctor.toml'),
      path.join(packageRoot, 'commands', 'omp', 'setup.toml'),
      path.join(packageRoot, 'commands', 'omp', 'team', 'run.toml'),
    ];

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(contextFilePath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      contextFileName?: string;
    };

    expect(manifest.contextFileName).toBe('GEMINI.md');

    for (const commandFile of commandFiles) {
      expect(existsSync(commandFile)).toBe(true);
    }

    expect(
      existsSync(path.join(packageRoot, 'extensions', 'oh-my-product')),
    ).toBe(false);
  });
});
