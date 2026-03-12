import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { cleanLegacySkillConflicts } from '../../src/cli/commands/setup.js';
import type { CliIo } from '../../src/cli/types.js';

function createIoCapture(): {
  io: CliIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout(message: string) {
        stdout.push(message);
      },
      stderr(message: string) {
        stderr.push(message);
      },
    },
    stdout,
    stderr,
  };
}

describe('smoke: legacy skill conflict cleanup', () => {
  let tempDir: string;
  let fakePackageRoot: string;
  let fakeUserSkillsDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `omg-test-skill-cleanup-${Date.now()}`);
    fakePackageRoot = path.join(tempDir, 'package');
    fakeUserSkillsDir = path.join(tempDir, 'home', '.agents', 'skills');

    // Create extension skills
    for (const skill of ['autopilot', 'plan', 'team']) {
      const dir = path.join(fakePackageRoot, 'skills', skill);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'SKILL.md'), `# extension ${skill}`);
    }
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('removes conflicting skill folders and preserves non-conflicting ones', () => {
    // Create user skills: 2 conflicting + 1 custom
    for (const skill of ['autopilot', 'plan', 'custom-skill']) {
      const dir = path.join(fakeUserSkillsDir, skill);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'SKILL.md'), `# legacy ${skill}`);
    }

    const ioCapture = createIoCapture();
    const removed = cleanLegacySkillConflicts(
      fakePackageRoot,
      ioCapture.io,
      fakeUserSkillsDir,
    );

    expect(removed.sort()).toStrictEqual(['autopilot', 'plan']);
    expect(existsSync(path.join(fakeUserSkillsDir, 'autopilot'))).toBe(false);
    expect(existsSync(path.join(fakeUserSkillsDir, 'plan'))).toBe(false);
    expect(existsSync(path.join(fakeUserSkillsDir, 'custom-skill'))).toBe(true);
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('returns empty array when no conflicts exist', () => {
    mkdirSync(path.join(fakeUserSkillsDir, 'custom-only'), { recursive: true });
    writeFileSync(
      path.join(fakeUserSkillsDir, 'custom-only', 'SKILL.md'),
      '# custom',
    );

    const ioCapture = createIoCapture();
    const removed = cleanLegacySkillConflicts(
      fakePackageRoot,
      ioCapture.io,
      fakeUserSkillsDir,
    );

    expect(removed).toStrictEqual([]);
  });

  test('returns empty array when extension skills dir does not exist', () => {
    const ioCapture = createIoCapture();
    const removed = cleanLegacySkillConflicts(
      '/nonexistent',
      ioCapture.io,
      fakeUserSkillsDir,
    );

    expect(removed).toStrictEqual([]);
  });

  test('returns empty array when user skills dir does not exist', () => {
    const ioCapture = createIoCapture();
    const removed = cleanLegacySkillConflicts(
      fakePackageRoot,
      ioCapture.io,
      path.join(tempDir, 'does-not-exist'),
    );

    expect(removed).toStrictEqual([]);
  });

  test('removes all conflicts when user has exact same set as extension', () => {
    for (const skill of ['autopilot', 'plan', 'team']) {
      const dir = path.join(fakeUserSkillsDir, skill);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'SKILL.md'), `# legacy ${skill}`);
    }

    const ioCapture = createIoCapture();
    const removed = cleanLegacySkillConflicts(
      fakePackageRoot,
      ioCapture.io,
      fakeUserSkillsDir,
    );

    expect(removed.sort()).toStrictEqual(['autopilot', 'plan', 'team']);
    expect(existsSync(fakeUserSkillsDir)).toBe(true);
  });
});
