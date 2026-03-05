import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { writeWorkerContext } from '../../src/hooks/context-writer.js';
import { readTeamContext } from '../../src/hooks/index.js';
import { dispatchSkill, listSkills, resolveSkill } from '../../src/skills/dispatcher.js';
import { createTempDir, removeDir, repoRoot } from '../utils/runtime.js';

const skillsDir = path.join(repoRoot, 'extensions', 'oh-my-gemini', 'skills');

describe('integration: skill runtime integration', () => {
  test('resolveSkill returns skill by name from extensions directory', async () => {
    const skill = await resolveSkill('plan', skillsDir);

    expect(skill).not.toBeNull();
    expect(skill?.name).toBeTruthy();
    expect(skill?.content).toBeTruthy();
    expect(skill?.skillPath).toContain('plan');
  });

  test('resolveSkill returns null for unknown skill name', async () => {
    const skill = await resolveSkill('totally-unknown-skill-xyzzy', skillsDir);
    expect(skill).toBeNull();
  });

  test('resolveSkill returns null for empty skills directory', async () => {
    const tempRoot = createTempDir('omg-skill-empty-');

    try {
      const emptyDir = path.join(tempRoot, 'skills');
      await fs.mkdir(emptyDir, { recursive: true });

      const skill = await resolveSkill('plan', emptyDir);
      expect(skill).toBeNull();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('listSkills returns at least 5 skills from extensions directory', async () => {
    const skills = await listSkills(skillsDir);
    expect(skills.length).toBeGreaterThanOrEqual(5);
  });

  test('all listed skills have required fields: name, content, skillPath', async () => {
    const skills = await listSkills(skillsDir);

    for (const skill of skills) {
      expect(typeof skill.name).toBe('string');
      expect(skill.name.length).toBeGreaterThan(0);
      expect(typeof skill.content).toBe('string');
      expect(skill.content.length).toBeGreaterThan(0);
      expect(typeof skill.skillPath).toBe('string');
      expect(skill.skillPath.length).toBeGreaterThan(0);
    }
  });

  test('resolveSkill rejects path traversal attempts (returns null)', async () => {
    const skill = await resolveSkill('../../../etc/passwd', skillsDir);
    expect(skill).toBeNull();
  });

  test('dispatchSkill returns a DispatchResult for a known skill', async () => {
    const result = await dispatchSkill('plan', ['my planning task'], { skillsDir });

    expect(result).not.toBeNull();
    expect(result?.skill).toBeDefined();
    expect(result?.prompt).toBe('my planning task');
  });

  test('dispatchSkill returns null for an unknown skill', async () => {
    const result = await dispatchSkill('no-such-skill-abc', [], { skillsDir });
    expect(result).toBeNull();
  });

  test('default resolver exposes deep-interview skill from src skill catalog', async () => {
    const skill = await resolveSkill('deep-interview');

    expect(skill).not.toBeNull();
    expect(skill?.name).toBe('deep-interview');
    expect(skill?.skillPath).toContain(path.join('src', 'skills', 'deep-interview'));
  });

  test('default listSkills merges source and extension skill catalogs', async () => {
    const skills = await listSkills();
    const skillNames = skills.map((skill) => skill.name);

    expect(skillNames).toContain('deep-interview');
    expect(skillNames).toContain('plan');
    expect(skillNames).toContain('team');
    expect(skillNames).toContain('review');
    expect(skillNames).toContain('verify');
    expect(skillNames).toContain('handoff');
    expect(new Set(skillNames).size).toBe(skillNames.length);
  });

  test('GEMINI.md context written by writeWorkerContext contains skill section discoverable by workers', async () => {
    const tempRoot = createTempDir('omg-skill-gemini-integration-');

    try {
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'skill-int-team',
        task: 'validate skill context injection',
        workers: 2,
      });

      const content = await readTeamContext(tempRoot);

      expect(content).not.toBeNull();
      expect(content).toContain('Available Skills');
      // Verify that workers can discover skill names through the context
      expect(content).toContain('omg skill list');
      expect(content).toContain('omg skill');
    } finally {
      removeDir(tempRoot);
    }
  });
});
