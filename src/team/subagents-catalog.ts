import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  TeamSubagentCatalog,
  TeamSubagentDefinition,
} from './types.js';
import {
  createDefaultSubagentCatalog,
  DEFAULT_UNIFIED_SUBAGENT_MODEL,
} from './subagents-blueprint.js';
import {
  listSupportedSkillAliases,
  resolveRoleCandidatesForSkillToken,
  resolveSubagentSkills,
} from './role-skill-mapping.js';

const CATALOG_RELATIVE_PATHS = ['.gemini/agents/catalog.json'] as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFirstNonEmptyString(
  record: JsonRecord,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

export function normalizeSubagentId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseSubagentTokens(
  raw: unknown,
  ownerId: string,
  index: number,
  options: {
    label: 'aliases' | 'skills';
    allowOwnerId?: boolean;
  },
): string[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  const rawTokens: string[] = [];

  const appendToken = (value: unknown): void => {
    if (typeof value !== 'string') {
      throw new Error(
        `Invalid subagent ${options.label} at index ${index}: expected string values.`,
      );
    }

    for (const token of value.split(',')) {
      rawTokens.push(token);
    }
  };

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      appendToken(entry);
    }
  } else {
    appendToken(raw);
  }

  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const token of rawTokens) {
    const normalized = normalizeSubagentId(token);
    if (
      !normalized ||
      (!options.allowOwnerId && normalized === ownerId) ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    aliases.push(normalized);
  }

  return aliases.length > 0 ? aliases : undefined;
}

function parseSubagentEntry(
  raw: unknown,
  fallbackModel: string,
  index: number,
): TeamSubagentDefinition {
  if (!isRecord(raw)) {
    throw new Error(`Invalid subagent entry at index ${index}: expected object.`);
  }

  const idCandidate = readFirstNonEmptyString(raw, ['id', 'name', 'role']);
  if (!idCandidate) {
    throw new Error(
      `Invalid subagent entry at index ${index}: missing non-empty "id" string.`,
    );
  }

  const id = normalizeSubagentId(idCandidate);
  if (!id) {
    throw new Error(
      `Invalid subagent entry at index ${index}: could not normalize id "${idCandidate}".`,
    );
  }

  const role = readFirstNonEmptyString(raw, ['role', 'title']) ?? id;
  const mission =
    readFirstNonEmptyString(raw, [
      'mission',
      'objective',
      'goal',
      'description',
      'prompt',
    ]) ?? `Execute ${role} responsibilities for the active team task.`;
  const aliases = parseSubagentTokens(raw.aliases ?? raw.alias, id, index, {
    label: 'aliases',
  });
  const catalogSkills = parseSubagentTokens(raw.skills ?? raw.skill, id, index, {
    label: 'skills',
    allowOwnerId: true,
  });
  let skills: TeamSubagentDefinition['skills'];
  try {
    skills = resolveSubagentSkills({
      roleId: id,
      aliases: [role, ...(aliases ?? [])],
      explicitSkills: catalogSkills,
    }).skills;
  } catch (error) {
    throw new Error(
      `Invalid subagent skills at index ${index}: ${(error as Error).message}`,
    );
  }

  return {
    id,
    role,
    mission,
    model: fallbackModel,
    aliases,
    skills,
  };
}

function parseCatalogFromRaw(
  raw: unknown,
  sourcePath: string | undefined,
): TeamSubagentCatalog {
  if (!isRecord(raw)) {
    throw new Error('Subagent catalog root must be a JSON object.');
  }

  const schemaVersionRaw = raw.schemaVersion;
  const schemaVersion =
    typeof schemaVersionRaw === 'number' && Number.isInteger(schemaVersionRaw) && schemaVersionRaw > 0
      ? schemaVersionRaw
      : 1;

  const unifiedModel =
    readFirstNonEmptyString(raw, ['unifiedModel', 'model']) ??
    DEFAULT_UNIFIED_SUBAGENT_MODEL;

  const subagentsRaw = raw.subagents;
  if (!Array.isArray(subagentsRaw) || subagentsRaw.length === 0) {
    throw new Error(
      'Subagent catalog requires a non-empty "subagents" array.',
    );
  }

  const seen = new Set<string>();
  const tokenOwners = new Map<string, string>();
  const subagents = subagentsRaw.map((entry, index) => {
    const parsed = parseSubagentEntry(entry, unifiedModel, index);
    if (seen.has(parsed.id)) {
      throw new Error(
        `Subagent catalog has duplicate id "${parsed.id}" at index ${index}.`,
      );
    }

    seen.add(parsed.id);
    tokenOwners.set(parsed.id, parsed.id);

    const candidateTokens = [
      normalizeSubagentId(parsed.role),
      ...(parsed.aliases ?? []),
    ];

    for (const token of candidateTokens) {
      if (!token || token === parsed.id) {
        continue;
      }

      const existingOwner = tokenOwners.get(token);
      if (existingOwner && existingOwner !== parsed.id) {
        throw new Error(
          `Subagent catalog token "${token}" at index ${index} conflicts with "${existingOwner}".`,
        );
      }

      tokenOwners.set(token, parsed.id);
    }

    return parsed;
  });

  return {
    schemaVersion,
    unifiedModel,
    sourcePath,
    subagents,
  };
}

function createEmbeddedCatalog(): TeamSubagentCatalog {
  return createDefaultSubagentCatalog();
}

async function tryReadCatalogFromDisk(
  cwd: string,
): Promise<{ raw: unknown; sourcePath: string } | null> {
  for (const relativePath of CATALOG_RELATIVE_PATHS) {
    const sourcePath = path.join(cwd, relativePath);

    try {
      const content = await fs.readFile(sourcePath, 'utf8');
      return {
        raw: JSON.parse(content) as unknown,
        sourcePath,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        continue;
      }

      if (error instanceof SyntaxError) {
        throw new Error(
          `Failed to parse subagent catalog JSON at ${sourcePath}: ${error.message}`,
        );
      }

      throw new Error(
        `Failed to read subagent catalog at ${sourcePath}: ${(error as Error).message}`,
      );
    }
  }

  return null;
}

export async function loadSubagentCatalog(cwd: string): Promise<TeamSubagentCatalog> {
  const diskCatalog = await tryReadCatalogFromDisk(cwd);
  if (!diskCatalog) {
    return createEmbeddedCatalog();
  }

  return parseCatalogFromRaw(diskCatalog.raw, diskCatalog.sourcePath);
}

export function resolveSubagentSelection(
  catalog: TeamSubagentCatalog,
  requestedIds: string[] | undefined,
): TeamSubagentDefinition[] {
  if (!requestedIds || requestedIds.length === 0) {
    return catalog.subagents;
  }

  const dedupedRequestedIds: string[] = [];
  const seen = new Set<string>();

  for (const requestedId of requestedIds) {
    const normalized = normalizeSubagentId(requestedId);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    dedupedRequestedIds.push(normalized);
  }

  if (dedupedRequestedIds.length === 0) {
    throw new Error(
      'Subagent selection must include at least one valid subagent id.',
    );
  }

  const byId = new Map<string, TeamSubagentDefinition>();
  const byToken = new Map<string, TeamSubagentDefinition>();

  for (const subagent of catalog.subagents) {
    byId.set(subagent.id, subagent);

    const candidateTokens = [
      subagent.id,
      normalizeSubagentId(subagent.role),
      ...(subagent.aliases ?? []),
    ];

    for (const token of candidateTokens) {
      if (!token) {
        continue;
      }

      const existing = byToken.get(token);
      if (existing && existing.id !== subagent.id) {
        throw new Error(
          `Subagent catalog token "${token}" resolves to multiple subagents: ${existing.id}, ${subagent.id}.`,
        );
      }

      byToken.set(token, subagent);
    }
  }

  const selectedSubagents: TeamSubagentDefinition[] = [];
  const seenCanonicalIds = new Set<string>();
  const unknownIds: string[] = [];

  for (const requestedId of dedupedRequestedIds) {
    let selected = byId.get(requestedId) ?? byToken.get(requestedId);

    if (!selected) {
      const roleCandidates = resolveRoleCandidatesForSkillToken(requestedId);
      for (const roleCandidate of roleCandidates) {
        const resolved = byId.get(roleCandidate);
        if (resolved) {
          selected = resolved;
          break;
        }
      }
    }

    if (!selected) {
      unknownIds.push(requestedId);
      continue;
    }

    if (seenCanonicalIds.has(selected.id)) {
      continue;
    }

    seenCanonicalIds.add(selected.id);
    selectedSubagents.push(selected);
  }

  if (unknownIds.length > 0) {
    const availableIds = [...new Set(catalog.subagents.map((subagent) => subagent.id))]
      .sort((a, b) => a.localeCompare(b));
    const supportedSkillAliases = [
      ...new Set(
        [
          ...listSupportedSkillAliases(),
          ...catalog.subagents.flatMap((subagent) => subagent.skills ?? []),
        ].map((token) => normalizeSubagentId(token)).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
    const skillAliasHint =
      supportedSkillAliases.length > 0
        ? ` Supported skill aliases: ${supportedSkillAliases.join(', ')}.`
        : '';
    throw new Error(
      `Unknown subagent id(s): ${unknownIds.join(', ')}. Available ids: ${availableIds.join(', ')}.${skillAliasHint}`,
    );
  }

  if (selectedSubagents.length === 0) {
    throw new Error(
      'Subagent selection must resolve to at least one available subagent.',
    );
  }

  return selectedSubagents;
}
