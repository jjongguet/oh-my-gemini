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
  deprecated: boolean;
  mergedInto?: string;
  aliasFor?: string;
  nonInstallable: boolean;
}

interface SkillFrontmatter {
  name?: string;
  aliases?: string[];
  primaryRole?: string;
  description?: string;
  deprecated?: boolean;
  mergedInto?: string;
  aliasFor?: string;
  aliasOf?: string;
  nonInstallable?: boolean;
  installable?: boolean;
}

function parseBooleanFrontmatterValue(rawValue: string): boolean | undefined {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return undefined;
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
    } else if (key === 'deprecated') {
      result.deprecated = parseBooleanFrontmatterValue(rawValue);
    } else if (key === 'nonInstallable') {
      result.nonInstallable = parseBooleanFrontmatterValue(rawValue);
    } else if (key === 'installable') {
      result.installable = parseBooleanFrontmatterValue(rawValue);
    } else if (key === 'mergedInto') {
      result.mergedInto = rawValue.replace(/^["']|["']$/g, '');
    } else if (key === 'aliasFor' || key === 'aliasOf') {
      const normalizedAlias = rawValue.replace(/^["']|["']$/g, '');
      result.aliasFor = normalizedAlias;
      result.aliasOf = normalizedAlias;
    }
  }

  return result;
}

function resolveDefaultSkillDirs(): string[] {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    // Source runtime (tsx): src/skills/
    currentDir,
    // Built runtime (dist): resolve back to src/skills if present in package/repo.
    path.resolve(currentDir, '../../src/skills'),
    // Extension fallback for packaged prompt assets.
    path.resolve(currentDir, '../../extensions/oh-my-gemini/skills'),
  ];

  const deduped = new Set<string>();
  for (const candidate of candidates) {
    deduped.add(path.resolve(candidate));
  }

  return [...deduped];
}

function shouldSkipSkill(skill: ResolvedSkill): boolean {
  return Boolean(skill.deprecated || skill.nonInstallable || skill.mergedInto || skill.aliasFor);
}

function buildResolvedSkill(params: {
  content: string;
  fallbackName: string;
  skillPath: string;
}): ResolvedSkill {
  const { content, fallbackName, skillPath } = params;
  const frontmatter = parseSkillFrontmatter(content);

  return {
    name: frontmatter.name ?? fallbackName,
    aliases: frontmatter.aliases ?? [],
    primaryRole: frontmatter.primaryRole ?? 'assistant',
    description: frontmatter.description ?? '',
    content,
    skillPath,
    deprecated: frontmatter.deprecated ?? false,
    mergedInto: frontmatter.mergedInto,
    aliasFor: frontmatter.aliasFor ?? frontmatter.aliasOf,
    nonInstallable: frontmatter.nonInstallable ?? frontmatter.installable === false,
  };
}

async function resolveSkillInDirectory(
  nameOrAlias: string,
  skillsDir: string,
): Promise<ResolvedSkill | null> {
  const dir = path.resolve(skillsDir);
  const normalized = nameOrAlias.toLowerCase().trim();

  // Try direct name match first — guard against path traversal.
  const directPath = path.resolve(dir, normalized, 'SKILL.md');
  const directPathSafe = directPath.startsWith(dir + path.sep);

  if (directPathSafe) {
    try {
      const content = await readFile(directPath, 'utf8');
      const resolved = buildResolvedSkill({
        content,
        fallbackName: normalized,
        skillPath: directPath,
      });
      return shouldSkipSkill(resolved) ? null : resolved;
    } catch {
      // Not a direct match — scan all skills for alias match.
    }
  }

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
      const resolved = buildResolvedSkill({
        content,
        fallbackName: entry.name,
        skillPath,
      });

      const allNames = [resolved.name, ...resolved.aliases];
      if (allNames.some((candidate) => candidate.toLowerCase() === normalized)) {
        return shouldSkipSkill(resolved) ? null : resolved;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function listSkillsInDirectory(skillsDir: string): Promise<ResolvedSkill[]> {
  const dir = path.resolve(skillsDir);
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
      const resolved = buildResolvedSkill({
        content,
        fallbackName: entry.name,
        skillPath,
      });

      if (shouldSkipSkill(resolved)) {
        continue;
      }

      skills.push(resolved);
    } catch {
      continue;
    }
  }

  return skills;
}

export async function resolveSkill(
  nameOrAlias: string,
  skillsDir?: string,
): Promise<ResolvedSkill | null> {
  if (skillsDir) {
    return resolveSkillInDirectory(nameOrAlias, skillsDir);
  }

  for (const defaultDir of resolveDefaultSkillDirs()) {
    const resolved = await resolveSkillInDirectory(nameOrAlias, defaultDir);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export async function listSkills(skillsDir?: string): Promise<ResolvedSkill[]> {
  if (skillsDir) {
    return listSkillsInDirectory(skillsDir);
  }

  const merged: ResolvedSkill[] = [];
  const seenNames = new Set<string>();

  for (const defaultDir of resolveDefaultSkillDirs()) {
    const listed = await listSkillsInDirectory(defaultDir);

    for (const skill of listed) {
      const key = skill.name.toLowerCase().trim();
      if (seenNames.has(key)) {
        continue;
      }

      seenNames.add(key);
      merged.push(skill);
    }
  }

  return merged;
}
