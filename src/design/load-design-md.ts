/**
 * Convenience function that encapsulates the full DESIGN.md discovery-read-parse pipeline.
 * Provides a single entry point for Phase 2 integration.
 */

import { readFile } from 'node:fs/promises';

import { discoverDesignMd } from './design-discovery.js';
import { parseDesignMd } from './parser.js';
import type { DesignSystem } from './types.js';

export interface LoadedDesignMd {
  readonly path: string;
  readonly system: DesignSystem;
}

/**
 * Discover, read, and parse a DESIGN.md file starting from the given directory.
 *
 * @param cwd - Directory to start searching from
 * @returns The parsed DesignSystem with its file path, or null if not found/unparseable
 */
export async function loadDesignMd(cwd: string): Promise<LoadedDesignMd | null> {
  try {
    const designPath = await discoverDesignMd(cwd);
    if (!designPath) return null;

    const content = await readFile(designPath, 'utf8');
    const system = parseDesignMd(content);
    if (!system) return null;

    return {
      path: designPath,
      system: { ...system, filePath: designPath },
    };
  } catch {
    return null;
  }
}
