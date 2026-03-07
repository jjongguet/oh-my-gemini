import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { listSkills, resolveSkill } from '../../src/skills/resolver.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

async function writeSkill(
  root: string,
  name: string,
  frontmatter: string,
): Promise<void> {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, 'SKILL.md'),
    `---\n${frontmatter}\n---\n\n# ${name}\n`,
    'utf8',
  );
}

describe('reliability: skill resolver hygiene', () => {
  test('listSkills skips deprecated, merged, alias-only, and non-installable skills', async () => {
    const tempRoot = createTempDir('omg-skill-hygiene-');

    try {
      await writeSkill(tempRoot, 'active', 'name: active');
      await writeSkill(tempRoot, 'deprecated-skill', 'name: deprecated-skill\ndeprecated: true');
      await writeSkill(tempRoot, 'merged-skill', 'name: merged-skill\nmergedInto: configure-notifications');
      await writeSkill(tempRoot, 'alias-only-skill', 'name: alias-only-skill\naliasFor: configure-notifications');
      await writeSkill(tempRoot, 'non-installable-skill', 'name: non-installable-skill\nnonInstallable: true');

      const skills = await listSkills(tempRoot);
      expect(skills.map((skill) => skill.name)).toStrictEqual(['active']);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('resolveSkill returns null for skipped skill metadata categories', async () => {
    const tempRoot = createTempDir('omg-skill-resolve-hygiene-');

    try {
      await writeSkill(tempRoot, 'deprecated-skill', 'name: deprecated-skill\ndeprecated: true\naliases: ["old-skill"]');
      await writeSkill(tempRoot, 'merged-skill', 'name: merged-skill\nmergedInto: configure-notifications');
      await writeSkill(tempRoot, 'alias-only-skill', 'name: alias-only-skill\naliasFor: configure-notifications');
      await writeSkill(tempRoot, 'non-installable-skill', 'name: non-installable-skill\nnonInstallable: true');

      await expect(resolveSkill('deprecated-skill', tempRoot)).resolves.toBeNull();
      await expect(resolveSkill('old-skill', tempRoot)).resolves.toBeNull();
      await expect(resolveSkill('merged-skill', tempRoot)).resolves.toBeNull();
      await expect(resolveSkill('alias-only-skill', tempRoot)).resolves.toBeNull();
      await expect(resolveSkill('non-installable-skill', tempRoot)).resolves.toBeNull();
    } finally {
      removeDir(tempRoot);
    }
  });
});
