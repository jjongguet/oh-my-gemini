/**
 * Token budget management for design system injection into agent prompts.
 * Controls how much design context each agent role receives.
 *
 * Design decisions:
 * - Tier 0: no injection (non-UI roles)
 * - Tier 1: one-line summary (default for unknown roles)
 * - Tier 2: full content (design-focused roles)
 * - Max chars controlled by OMP_DESIGN_MAX_TOKENS env var (default 3000)
 */

import { sanitizeDesignContent } from './security.js';
import type { DesignSystem } from './types.js';

/**
 * Roles that receive no design context (Tier 0).
 * These roles work on non-UI tasks where design context adds noise.
 */
const TIER_0_ROLES = [
  'git-master',
  'document-specialist',
  'tracer',
  'scientist',
  'debugger',
] as const;

/**
 * Roles that receive full design context (Tier 2).
 * These roles directly author or validate UI/design work.
 */
const TIER_2_ROLES = [
  'designer',
  'design-architect',
  'design-validator',
  'qa-tester',
] as const;

/**
 * Read the configured max token budget for design section injection.
 * Source: OMP_DESIGN_MAX_TOKENS env var, parsed as integer.
 * Falls back to 3000 characters.
 */
export function getDesignMaxTokens(): number {
  const raw = process.env['OMP_DESIGN_MAX_TOKENS'];
  if (raw !== undefined && raw !== '') {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 3000;
}

/**
 * Determine injection tier for a given agent role.
 *
 * - Tier 0: no injection
 * - Tier 1: summary only (default)
 * - Tier 2: full content
 */
export function getInjectionTier(role?: string): 0 | 1 | 2 {
  if (role === undefined) return 1;

  const normalized = role.trim();

  if ((TIER_0_ROLES as readonly string[]).includes(normalized)) return 0;
  if ((TIER_2_ROLES as readonly string[]).includes(normalized)) return 2;

  return 1;
}

/**
 * Build the design section string to inject into an agent's prompt.
 *
 * - Tier 0: empty string
 * - Tier 1: one-line summary listing present categories
 * - Tier 2: full section content, truncated to maxTokens chars
 */
export function buildDesignSection(
  system: DesignSystem,
  tier: 0 | 1 | 2,
): string {
  if (tier === 0) return '';

  const categoryList = [...system.categories].join(', ');

  if (tier === 1) {
    return `Project has DESIGN.md with: ${categoryList}. Refer to DESIGN.md for UI tasks.`;
  }

  // Tier 2: full content from all sections
  const maxTokens = getDesignMaxTokens();
  const parts: string[] = [];

  for (const section of system.sections) {
    parts.push(`## ${section.heading}\n${section.content}`);
  }

  const raw = parts.join('\n\n');
  const full = sanitizeDesignContent(raw);
  return full.length > maxTokens ? full.slice(0, maxTokens) : full;
}
