import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ResolvedSkill {
  name: string;
  aliases: string[];
  primaryRole: string;
  description: string;
  content: string;
  skillPath: string;
}

interface SkillFrontmatter {
  name?: string;
  aliases?: string[];
  primaryRole?: string;
  description?: string;
}

function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatterText = frontmatterMatch[1] ?? '';
  const result: SkillFrontmatter = {};

  for (const line of frontmatterText.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (key === 'name') {
      result.name = rawValue;
    } else if (key === 'primaryRole') {
      result.primaryRole = rawValue;
    } else if (key === 'description') {
      result.description = rawValue;
    } else if (key === 'aliases') {
      // Parse simple YAML array: ["/team", "team run"]
      const arrayMatch = rawValue.match(/^\[(.*)\]$/);
      if (arrayMatch) {
        result.aliases = (arrayMatch[1] ?? '')
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
      }
    }
  }

  return result;
}

function resolveExtensionSkillsDir(): string {
  // From dist/skills/resolver.js, go up to project root then into extensions
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../../extensions/oh-my-gemini/skills');
}

export async function resolveSkill(
  nameOrAlias: string,
  skillsDir?: string,
): Promise<ResolvedSkill | null> {
  const dir = skillsDir ?? resolveExtensionSkillsDir();
  const resolvedDir = path.resolve(dir);
  const normalized = nameOrAlias.toLowerCase().trim();

  // Try direct name match first — guard against path traversal
  const directPath = path.resolve(dir, normalized, 'SKILL.md');
  const directPathSafe = directPath.startsWith(resolvedDir + path.sep);
  if (directPathSafe) try {
    const content = await readFile(directPath, 'utf8');
    const frontmatter = parseSkillFrontmatter(content);
    return {
      name: frontmatter.name ?? normalized,
      aliases: frontmatter.aliases ?? [],
      primaryRole: frontmatter.primaryRole ?? 'assistant',
      description: frontmatter.description ?? '',
      content,
      skillPath: directPath,
    };
  } catch {
    // Not a direct match — scan all skills for alias match
  }

  // Scan all skill directories for alias match
  let skillDirs: Dirent[] = [];
  try {
    skillDirs = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of skillDirs) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(dir, entry.name, 'SKILL.md');
    try {
      const content = await readFile(skillPath, 'utf8');
      const frontmatter = parseSkillFrontmatter(content);

      const aliases = frontmatter.aliases ?? [];
      const allNames = [frontmatter.name ?? entry.name, ...aliases];

      if (allNames.some((a) => a.toLowerCase() === normalized)) {
        return {
          name: frontmatter.name ?? entry.name,
          aliases,
          primaryRole: frontmatter.primaryRole ?? 'assistant',
          description: frontmatter.description ?? '',
          content,
          skillPath,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function listSkills(skillsDir?: string): Promise<ResolvedSkill[]> {
  const dir = skillsDir ?? resolveExtensionSkillsDir();
  const skills: ResolvedSkill[] = [];

  let entries: Dirent[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(dir, entry.name, 'SKILL.md');
    try {
      const content = await readFile(skillPath, 'utf8');
      const frontmatter = parseSkillFrontmatter(content);

      skills.push({
        name: frontmatter.name ?? entry.name,
        aliases: frontmatter.aliases ?? [],
        primaryRole: frontmatter.primaryRole ?? 'assistant',
        description: frontmatter.description ?? '',
        content,
        skillPath,
      });
    } catch {
      continue;
    }
  }

  return skills;
}
