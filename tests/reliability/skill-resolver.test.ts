import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { listSkills, resolveSkill } from '../../src/skills/resolver.js';
import { repoRoot } from '../utils/runtime.js';

const REQUIRED_SKILLS = [
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
] as const;

describe('reliability: skill resolver registration', () => {
  test('lists all required local skills from src/skills', async () => {
    const skillsDir = path.join(repoRoot, 'src', 'skills');
    const skills = await listSkills(skillsDir);
    const names = new Set(skills.map((skill) => skill.name));

    for (const skillName of REQUIRED_SKILLS) {
      expect(names.has(skillName), `missing skill ${skillName}`).toBe(true);
    }
  });

  test('resolves required skills by canonical name', async () => {
    const skillsDir = path.join(repoRoot, 'src', 'skills');

    for (const skillName of REQUIRED_SKILLS) {
      const resolved = await resolveSkill(skillName, skillsDir);
      expect(resolved?.name).toBe(skillName);
      expect(resolved?.content.length ?? 0).toBeGreaterThan(0);
    }
  });
});
