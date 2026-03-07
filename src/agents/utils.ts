/**
 * Agent Utilities for Oh-My-Gemini
 *
 * Shared utilities for agent creation and management.
 * Ported from OMC, adapted for Gemini API.
 */

import { readFileSync } from 'fs';
import { join, dirname, basename, resolve, relative, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

import type {
  AgentConfig,
  AgentPromptMetadata,
  AvailableAgent,
  AgentOverrideConfig,
  ModelType,
} from './types.js';

// ============================================================
// DYNAMIC PROMPT LOADING
// ============================================================

declare const __AGENT_PROMPTS__: Record<string, string> | undefined;

function getPackageDir(): string {
  if (typeof __dirname !== 'undefined' && __dirname) {
    const currentDirName = basename(__dirname);
    const parentDirName = basename(dirname(__dirname));

    if (currentDirName === 'bridge') {
      return join(__dirname, '..');
    }

    if (currentDirName === 'agents' && (parentDirName === 'src' || parentDirName === 'dist')) {
      return join(__dirname, '..', '..');
    }
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname_esm = dirname(__filename);
    return join(__dirname_esm, '..', '..');
  } catch {
    // import.meta.url unavailable
  }

  return process.cwd();
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return match?.[1]?.trim() ?? content.trim();
}

/**
 * Load an agent prompt from /agents/{agentName}.md
 */
export function loadAgentPrompt(agentName: string): string {
  if (!/^[a-z0-9-]+$/i.test(agentName)) {
    throw new Error('Invalid agent name: contains disallowed characters');
  }

  try {
    if (typeof __AGENT_PROMPTS__ !== 'undefined' && __AGENT_PROMPTS__ !== null) {
      const prompt = __AGENT_PROMPTS__[agentName];
      if (prompt) return prompt;
    }
  } catch {
    // __AGENT_PROMPTS__ not defined
  }

  try {
    const agentsDir = join(getPackageDir(), 'agents');
    const agentPath = join(agentsDir, `${agentName}.md`);

    const resolvedPath = resolve(agentPath);
    const resolvedAgentsDir = resolve(agentsDir);
    const rel = relative(resolvedAgentsDir, resolvedPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error('Invalid agent name: path traversal detected');
    }

    const content = readFileSync(agentPath, 'utf-8');
    return stripFrontmatter(content);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Invalid agent name')
        ? error.message
        : 'Agent prompt file not found';
    console.warn(`[loadAgentPrompt] ${message}`);
    return `Agent: ${agentName}\n\nPrompt unavailable.`;
  }
}

/**
 * Create tool restrictions configuration
 */
export function createAgentToolRestrictions(
  blockedTools: string[],
): { tools: Record<string, boolean> } {
  const restrictions: Record<string, boolean> = {};
  for (const tool of blockedTools) {
    restrictions[tool.toLowerCase()] = false;
  }
  return { tools: restrictions };
}

/**
 * Merge agent configuration with overrides
 */
export function mergeAgentConfig(
  base: AgentConfig,
  override: AgentOverrideConfig,
): AgentConfig {
  const { prompt_append, ...rest } = override;

  const merged: AgentConfig = {
    ...base,
    ...(rest.model && { model: rest.model as ModelType }),
    ...(rest.enabled !== undefined && { enabled: rest.enabled }),
  };

  if (prompt_append && merged.prompt) {
    merged.prompt = merged.prompt + '\n\n' + prompt_append;
  }

  return merged;
}

/**
 * Build delegation table section for OMG prompt
 */
export function buildDelegationTable(availableAgents: AvailableAgent[]): string {
  if (availableAgents.length === 0) {
    return '';
  }

  const rows = availableAgents
    .filter((a) => a.metadata.triggers.length > 0)
    .map((a) => {
      const triggers = a.metadata.triggers
        .map((t) => `${t.domain}: ${t.trigger}`)
        .join('; ');
      return `| ${a.metadata.promptAlias || a.name} | ${a.metadata.cost} | ${triggers} |`;
    });

  if (rows.length === 0) {
    return '';
  }

  return `### Agent Delegation Table

| Agent | Cost | When to Use |
|-------|------|-------------|
${rows.join('\n')}`;
}

/**
 * Build use/avoid section for an agent
 */
export function buildUseAvoidSection(metadata: AgentPromptMetadata): string {
  const sections: string[] = [];

  if (metadata.useWhen && metadata.useWhen.length > 0) {
    sections.push(
      `**USE when:**\n${metadata.useWhen.map((u) => `- ${u}`).join('\n')}`,
    );
  }

  if (metadata.avoidWhen && metadata.avoidWhen.length > 0) {
    sections.push(
      `**AVOID when:**\n${metadata.avoidWhen.map((a) => `- ${a}`).join('\n')}`,
    );
  }

  return sections.join('\n\n');
}

/**
 * Create environment context for agents
 */
export function createEnvContext(): string {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `
<env-context>
  Current time: ${timeStr}
  Timezone: ${timezone}
  Locale: ${locale}
</env-context>`;
}

/**
 * Get all available agents as AvailableAgent descriptors
 */
export function getAvailableAgents(
  agents: Record<string, AgentConfig>,
): AvailableAgent[] {
  return Object.entries(agents)
    .filter(([, config]) => config.metadata)
    .map(([name, config]) => ({
      name,
      description: config.description,
      metadata: config.metadata!,
    }));
}

/**
 * Build key triggers section for OMG prompt
 */
export function buildKeyTriggersSection(
  availableAgents: AvailableAgent[],
): string {
  const triggers: string[] = [];

  for (const agent of availableAgents) {
    for (const trigger of agent.metadata.triggers) {
      triggers.push(
        `- **${trigger.domain}** → ${agent.metadata.promptAlias || agent.name}: ${trigger.trigger}`,
      );
    }
  }

  if (triggers.length === 0) {
    return '';
  }

  return `### Key Triggers (CHECK BEFORE ACTING)\n\n${triggers.join('\n')}`;
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: AgentConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Agent name is required');
  }

  if (!config.description) {
    errors.push('Agent description is required');
  }

  if (!config.prompt) {
    errors.push('Agent prompt is required');
  }

  return errors;
}

/**
 * Parse disallowedTools from agent markdown frontmatter
 */
export function parseDisallowedTools(agentName: string): string[] | undefined {
  if (!/^[a-z0-9-]+$/i.test(agentName)) {
    return undefined;
  }

  try {
    const agentsDir = join(getPackageDir(), 'agents');
    const agentPath = join(agentsDir, `${agentName}.md`);

    const resolvedPath = resolve(agentPath);
    const resolvedAgentsDir = resolve(agentsDir);
    const rel = relative(resolvedAgentsDir, resolvedPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return undefined;
    }

    const content = readFileSync(agentPath, 'utf-8');

    const match = content.match(/^---[\s\S]*?---/);
    if (!match) return undefined;

    const disallowedMatch = match[0].match(/^disallowedTools:\s*(.+)/m);
    if (!disallowedMatch?.[1]) return undefined;

    return disallowedMatch[1]
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

/**
 * Standard path for open questions file
 */
export const OPEN_QUESTIONS_PATH = '.omg/plans/open-questions.md';

/**
 * Format open questions for appending to open-questions.md file.
 */
export function formatOpenQuestions(
  topic: string,
  questions: Array<{ question: string; reason: string }>,
): string {
  if (questions.length === 0) return '';

  const date = new Date().toISOString().split('T')[0];
  const items = questions
    .map((q) => `- [ ] ${q.question} — ${q.reason}`)
    .join('\n');

  return `\n## ${topic} - ${date}\n${items}\n`;
}

/**
 * Deep merge utility for configurations
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}
