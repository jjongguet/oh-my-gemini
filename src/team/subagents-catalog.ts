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

  return {
    id,
    role,
    mission,
    model: fallbackModel,
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
  const subagents = subagentsRaw.map((entry, index) => {
    const parsed = parseSubagentEntry(entry, unifiedModel, index);
    if (seen.has(parsed.id)) {
      throw new Error(
        `Subagent catalog has duplicate id "${parsed.id}" at index ${index}.`,
      );
    }

    seen.add(parsed.id);
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

  const byId = new Map(
    catalog.subagents.map((subagent) => [subagent.id, subagent] as const),
  );
  const unknownIds = dedupedRequestedIds.filter((id) => !byId.has(id));

  if (unknownIds.length > 0) {
    const available = [...byId.keys()].sort((a, b) => a.localeCompare(b));
    throw new Error(
      `Unknown subagent id(s): ${unknownIds.join(', ')}. Available: ${available.join(', ')}`,
    );
  }

  return dedupedRequestedIds.map((id) => {
    const selected = byId.get(id);
    if (!selected) {
      throw new Error(
        `Subagent "${id}" is unavailable after catalog resolution.`,
      );
    }
    return selected;
  });
}
