import { describe, expect, test } from 'vitest';

import { getAgentDefinitions } from '../../src/agents/definitions.js';
import { createDefaultSubagentCatalog } from '../../src/team/subagents-blueprint.js';

describe('reliability: design agents registration', () => {
  test('design-architect in getAgentDefinitions', () => {
    const result = getAgentDefinitions();
    const entry = result['design-architect'];
    expect(entry).toBeDefined();
    expect(entry!.description.length).toBeGreaterThan(0);
    expect(entry!.prompt.length).toBeGreaterThan(0);
  });

  test('design-validator in getAgentDefinitions', () => {
    const result = getAgentDefinitions();
    const entry = result['design-validator'];
    expect(entry).toBeDefined();
    expect(entry!.description.length).toBeGreaterThan(0);
    expect(entry!.prompt.length).toBeGreaterThan(0);
  });

  test('design-architect blueprint registered', () => {
    const catalog = createDefaultSubagentCatalog();
    const entry = catalog.subagents.find((s) => s.id === 'design-architect');
    expect(entry).toBeDefined();
  });

  test('design-validator blueprint registered', () => {
    const catalog = createDefaultSubagentCatalog();
    const entry = catalog.subagents.find((s) => s.id === 'design-validator');
    expect(entry).toBeDefined();
  });

  test('both agents have correct role in blueprints', () => {
    const catalog = createDefaultSubagentCatalog();
    const architect = catalog.subagents.find((s) => s.id === 'design-architect');
    const validator = catalog.subagents.find((s) => s.id === 'design-validator');
    expect(architect?.role).toBe('design-architect');
    expect(validator?.role).toBe('design-validator');
  });
});
