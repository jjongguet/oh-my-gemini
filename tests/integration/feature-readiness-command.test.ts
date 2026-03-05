import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoRoot, runCommand } from '../utils/runtime.js';

describe('integration: feature readiness command', () => {
  test('registers verify:features npm script and points to feature-readiness-check', () => {
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['verify:features']).toBe(
      'bash scripts/feature-readiness-check.sh',
    );
  });

  test('feature-readiness script exists and supports dry-run mode', () => {
    const scriptPath = path.join(repoRoot, 'scripts', 'feature-readiness-check.sh');
    expect(existsSync(scriptPath)).toBe(true);

    const result = runCommand('bash', [scriptPath, '--dry-run'], {
      cwd: repoRoot,
      env: {
        ...process.env,
      },
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout).toContain('Feature 1: Team Orchestration command contract');
    expect(result.stdout).toContain('Feature 2: Hook System integration test');
    expect(result.stdout).toContain('Feature 3: Agent Skill/Role integration + reliability tests');
    expect(result.stdout).toContain('Feature 4: Setup/Doctor command help contract');
    expect(result.stdout).toContain('Feature 5: Core command smoke (verify/extension/skill)');
    expect(result.stdout).toContain('- mode: dry-run');
  });

  test('feature-readiness supports --feature team --dry-run filtering', () => {
    const scriptPath = path.join(repoRoot, 'scripts', 'feature-readiness-check.sh');
    const result = runCommand('bash', [scriptPath, '--feature', 'team', '--dry-run'], {
      cwd: repoRoot,
      env: {
        ...process.env,
      },
    });

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
    expect(result.stdout).toContain('Feature 1: Team Orchestration command contract');
    expect(result.stdout).toContain('Feature 1: Team Orchestration focused tests');
    expect(result.stdout).not.toContain('Feature 2: Hook System integration test');
    expect(result.stdout).toContain('- selected_feature: team');
    expect(result.stdout).toContain('- mode: dry-run');
    expect(result.stdout).toContain('- checks_total: 2');
  });

  test.each([
    {
      feature: 'hook',
      expectedSection: 'Feature 2: Hook System integration test',
      excludedSection: 'Feature 1: Team Orchestration command contract',
      expectedChecksTotal: 1,
    },
    {
      feature: 'skill',
      expectedSection: 'Feature 3: Agent Skill/Role integration + reliability tests',
      excludedSection: 'Feature 4: Setup/Doctor command help contract',
      expectedChecksTotal: 1,
    },
    {
      feature: 'setup',
      expectedSection: 'Feature 4: Setup/Doctor command help contract',
      excludedSection: 'Feature 5: Core command smoke (verify/extension/skill)',
      expectedChecksTotal: 1,
    },
    {
      feature: 'core',
      expectedSection: 'Feature 5: Core command smoke (verify/extension/skill)',
      excludedSection: 'Feature 2: Hook System integration test',
      expectedChecksTotal: 5,
    },
  ])(
    'feature-readiness supports --feature $feature --dry-run filtering',
    ({ feature, expectedSection, excludedSection, expectedChecksTotal }) => {
      const scriptPath = path.join(repoRoot, 'scripts', 'feature-readiness-check.sh');
      const result = runCommand('bash', [scriptPath, '--feature', feature, '--dry-run'], {
        cwd: repoRoot,
        env: {
          ...process.env,
        },
      });

      expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);
      expect(result.stdout).toContain(expectedSection);
      expect(result.stdout).not.toContain(excludedSection);
      expect(result.stdout).toContain(`- selected_feature: ${feature}`);
      expect(result.stdout).toContain(`- checks_total: ${expectedChecksTotal}`);
    },
  );

  test('feature-readiness rejects invalid --feature values with usage output', () => {
    const scriptPath = path.join(repoRoot, 'scripts', 'feature-readiness-check.sh');
    const result = runCommand('bash', [scriptPath, '--feature', 'nope'], {
      cwd: repoRoot,
      env: {
        ...process.env,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[feature-readiness] invalid --feature value: nope');
    expect(result.stderr).toContain('Usage: feature-readiness-check.sh');
  });

  test('feature-readiness rejects missing --feature value with usage output', () => {
    const scriptPath = path.join(repoRoot, 'scripts', 'feature-readiness-check.sh');
    const result = runCommand('bash', [scriptPath, '--feature'], {
      cwd: repoRoot,
      env: {
        ...process.env,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[feature-readiness] --feature requires a value');
    expect(result.stderr).toContain('Usage: feature-readiness-check.sh');
  });
});
