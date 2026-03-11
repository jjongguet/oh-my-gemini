import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { writeWorkerContext } from '../../src/hooks/context-writer.js';
import { readTeamContext } from '../../src/hooks/index.js';
import { dispatchSkill, listSkills, resolveSkill } from '../../src/skills/dispatcher.js';
import { createTempDir, removeDir, repoRoot } from '../utils/runtime.js';

const skillsDir = path.join(repoRoot, 'skills');

describe('integration: skill runtime integration', () => {
  test('resolveSkill returns skill by name from the extension skill catalog', async () => {
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

  test('listSkills returns at least 20 skills from the extension skill catalog', async () => {
    const skills = await listSkills(skillsDir);
    expect(skills.length).toBeGreaterThanOrEqual(20);
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

  test('extension skill inventory contains the expanded parity set', async () => {
    const skills = await listSkills(skillsDir);
    const names = new Set(skills.map((skill) => skill.name));

    const expectedExtensionSkills = [
      'ask',
      'autopilot',
      'cancel',
      'configure-notifications',
      'cost',
      'debug',
      'deep-interview',
      'doctor',
      'execute',
      'handoff',
      'help',
      'hud-setup',
      'learn',
      'plan',
      'review',
      'sessions',
      'status',
      'team',
      'verify',
      'wait',
    ];

    expect(skills.length).toBeGreaterThanOrEqual(expectedExtensionSkills.length);

    for (const skillName of expectedExtensionSkills) {
      expect(names.has(skillName), `missing extension skill ${skillName}`).toBe(true);
    }
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

  test('default resolver exposes all expected source skills from src skill catalog', async () => {
    const expectedSourceSkills = [
      'cancel',
      'debug',
      'execute',
      'help',
      'status',
      'configure-notifications',
      'deep-interview',
      'handoff',
      'review',
      'verify',
    ];

    for (const skillName of expectedSourceSkills) {
      const skill = await resolveSkill(skillName);
      expect(skill, `expected skill ${skillName} to resolve`).not.toBeNull();
      expect(skill?.name).toBe(skillName);
      expect(skill?.skillPath).toContain(path.join('src', 'skills', skillName));
    }
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
    expect(skillNames).toContain('configure-notifications');
    expect(skillNames).toContain('autopilot');
    expect(skillNames).toContain('ask');
    expect(skillNames).toContain('doctor');
    expect(skillNames).toContain('cost');
    expect(skillNames).toContain('hud-setup');
    expect(skillNames).toContain('sessions');
    expect(skillNames).toContain('wait');
    expect(new Set(skillNames).size).toBe(skillNames.length);
  });


  test('listSkills skips deprecated, merged, alias-only, and non-installable entries', async () => {
    const tempRoot = createTempDir('omg-skill-skip-metadata-');

    try {
      const tempSkillsDir = path.join(tempRoot, 'skills');
      await fs.mkdir(tempSkillsDir, { recursive: true });

      const fixtures = {
        stable: `---\nname: stable\ndescription: stable\n---\n# stable\n`,
        deprecated: `---\nname: old-skill\ndeprecated: true\n---\n# deprecated\n`,
        merged: `---\nname: merged-skill\nmergedInto: stable\n---\n# merged\n`,
        aliasOnly: `---\nname: alias-skill\naliasOf: stable\n---\n# alias\n`,
        hidden: `---\nname: hidden-skill\ninstallable: false\n---\n# hidden\n`,
      };

      for (const [dirName, content] of Object.entries(fixtures)) {
        const skillDir = path.join(tempSkillsDir, dirName);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');
      }

      const skills = await listSkills(tempSkillsDir);
      expect(skills.map((skill) => skill.name)).toStrictEqual(['stable']);

      await expect(resolveSkill('old-skill', tempSkillsDir)).resolves.toBeNull();
      await expect(resolveSkill('merged-skill', tempSkillsDir)).resolves.toBeNull();
      await expect(resolveSkill('alias-skill', tempSkillsDir)).resolves.toBeNull();
      await expect(resolveSkill('hidden-skill', tempSkillsDir)).resolves.toBeNull();
    } finally {
      removeDir(tempRoot);
    }
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
