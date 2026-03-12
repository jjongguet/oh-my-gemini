import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { DEFAULT_SUBAGENT_BLUEPRINTS } from '../../src/team/subagents-blueprint.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(PACKAGE_ROOT, 'agents');

/** Known valid Gemini CLI tool names */
const VALID_TOOL_NAMES = new Set([
  'read_file',
  'write_file',
  'replace',
  'run_shell_command',
  'list_directory',
  'glob',
  'grep_search',
  'web_fetch',
  'google_web_search',
]);

/** Read-only agents must NOT have these tools */
const WRITE_TOOLS = new Set(['write_file', 'replace', 'run_shell_command']);

/** Agents that should be read-only (no write/exec tools) */
const READ_ONLY_AGENTS = new Set([
  'explore',
  'analyst',
  'critic',
  'quality-reviewer',
  'security-reviewer',
]);

/** Optional agents that exist in code but NOT in subagents-blueprint */
const OPTIONAL_AGENTS_NOT_IN_BLUEPRINT = new Set(['harsh-critic']);

interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string[];
  [key: string]: unknown;
}

function parseFrontmatter(content: string): AgentFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  let currentKey = '';
  let currentArray: string[] | null = null;

  for (const line of yaml.split('\n')) {
    const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayItemMatch && currentArray) {
      currentArray.push(arrayItemMatch[1]!.trim());
      continue;
    }

    if (currentArray && currentKey) {
      result[currentKey] = currentArray;
      currentArray = null;
    }

    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1]!;
      const value = kvMatch[2]?.trim() ?? '';

      if (value === '' || value === undefined) {
        currentArray = [];
      } else {
        result[currentKey] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  if (currentArray && currentKey) {
    result[currentKey] = currentArray;
  }

  if (!result.name || !result.description || !Array.isArray(result.tools)) {
    return null;
  }

  return result as unknown as AgentFrontmatter;
}

function getBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return match?.[1]?.trim() ?? '';
}

describe('reliability: native agent .md files', () => {
  const blueprintIds = DEFAULT_SUBAGENT_BLUEPRINTS.map((b) => b.id);
  const blueprintMap = new Map(
    DEFAULT_SUBAGENT_BLUEPRINTS.map((b) => [b.id, b]),
  );

  const agentFiles = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));

  test('all 21 blueprint agents have corresponding .md files', () => {
    for (const id of blueprintIds) {
      expect(
        agentFiles,
        `Missing agent file for blueprint "${id}"`,
      ).toContain(id);
    }
    expect(agentFiles.length).toBeGreaterThanOrEqual(blueprintIds.length);
  });

  test('no unexpected agent files beyond blueprints and known optionals', () => {
    for (const file of agentFiles) {
      const isBlueprint = blueprintMap.has(file);
      const isOptional = OPTIONAL_AGENTS_NOT_IN_BLUEPRINT.has(file);
      expect(
        isBlueprint || isOptional,
        `Unexpected agent file: agents/${file}.md — not in blueprint or optional list`,
      ).toBe(true);
    }
  });

  for (const id of blueprintIds) {
    describe(`agent: ${id}`, () => {
      const filePath = path.join(AGENTS_DIR, `${id}.md`);
      let content: string;
      let frontmatter: AgentFrontmatter | null;
      let body: string;

      try {
        content = readFileSync(filePath, 'utf-8');
        frontmatter = parseFrontmatter(content);
        body = getBody(content);
      } catch {
        content = '';
        frontmatter = null;
        body = '';
      }

      test('has valid YAML frontmatter with required fields', () => {
        expect(frontmatter, `Failed to parse frontmatter for ${id}`).not.toBeNull();
        expect(frontmatter!.name).toBe(id);
        expect(typeof frontmatter!.description).toBe('string');
        expect(frontmatter!.description.length).toBeGreaterThan(10);
        expect(Array.isArray(frontmatter!.tools)).toBe(true);
        expect(frontmatter!.tools.length).toBeGreaterThan(0);
      });

      test('does not have model field in frontmatter', () => {
        expect(frontmatter).not.toBeNull();
        expect(
          (frontmatter as Record<string, unknown>).model,
          `Agent ${id} should not have model field — Gemini CLI manages model selection`,
        ).toBeUndefined();
      });

      test('all tool names are valid Gemini CLI tools', () => {
        expect(frontmatter).not.toBeNull();
        for (const tool of frontmatter!.tools) {
          expect(
            VALID_TOOL_NAMES.has(tool),
            `Agent ${id} has unknown tool "${tool}". Valid tools: ${[...VALID_TOOL_NAMES].join(', ')}`,
          ).toBe(true);
        }
      });

      test('read-only agents do not have write/exec tools', () => {
        if (!READ_ONLY_AGENTS.has(id)) return;
        expect(frontmatter).not.toBeNull();
        for (const tool of frontmatter!.tools) {
          expect(
            WRITE_TOOLS.has(tool),
            `Read-only agent ${id} should not have tool "${tool}"`,
          ).toBe(false);
        }
      });

      test('frontmatter name matches blueprint id', () => {
        const blueprint = blueprintMap.get(id);
        expect(blueprint).toBeDefined();
        expect(frontmatter).not.toBeNull();
        expect(frontmatter!.name).toBe(blueprint!.id);
      });

      test('frontmatter description matches blueprint mission', () => {
        const blueprint = blueprintMap.get(id);
        expect(blueprint).toBeDefined();
        expect(frontmatter).not.toBeNull();
        expect(frontmatter!.description).toBe(blueprint!.mission);
      });

      test('body text is non-empty and meaningful', () => {
        expect(body.length).toBeGreaterThan(50);
        expect(body).toContain('Mission');
        expect(body).toContain('Guidelines');
      });
    });
  }
});
