import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Hoisted mock handles — must be declared before vi.mock calls
const { mkdirMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn().mockResolvedValue(undefined),
  writeFileMock: vi.fn().mockResolvedValue(undefined),
}));

const { loadDesignMdMock } = vi.hoisted(() => ({
  loadDesignMdMock: vi.fn(),
}));

const { loadLearnedPatternsMock } = vi.hoisted(() => ({
  loadLearnedPatternsMock: vi.fn().mockResolvedValue([]),
}));

const { loadProjectMemoryMock, formatProjectMemorySummaryMock } = vi.hoisted(() => ({
  loadProjectMemoryMock: vi.fn().mockResolvedValue({
    schemaVersion: 1 as const,
    updatedAt: new Date().toISOString(),
    directives: [],
    notes: [],
    hotPaths: [],
    recentTasks: [],
    learnedSkillIds: [],
  }),
  formatProjectMemorySummaryMock: vi.fn().mockReturnValue(''),
}));

const { listCanonicalRoleSkillMappingsMock } = vi.hoisted(() => ({
  listCanonicalRoleSkillMappingsMock: vi.fn().mockReturnValue([]),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    mkdir: mkdirMock,
    writeFile: writeFileMock,
  };
});

vi.mock('../../src/design/load-design-md.js', () => ({
  loadDesignMd: loadDesignMdMock,
}));

vi.mock('../../src/hooks/learner/index.js', () => ({
  loadLearnedPatterns: loadLearnedPatternsMock,
}));

vi.mock('../../src/hooks/project-memory/index.js', () => ({
  loadProjectMemory: loadProjectMemoryMock,
  formatProjectMemorySummary: formatProjectMemorySummaryMock,
}));

vi.mock('../../src/team/role-skill-mapping.js', () => ({
  listCanonicalRoleSkillMappings: listCanonicalRoleSkillMappingsMock,
}));

import type { DesignSystem } from '../../src/design/types.js';
import { writeWorkerContext } from '../../src/hooks/context-writer.js';

// A minimal DesignSystem fixture for use in tests
function makeDesignSystem(): DesignSystem {
  return {
    sections: [
      {
        heading: 'Visual Theme',
        category: 'visual-theme',
        content: 'Use dark backgrounds with high-contrast text.',
      },
    ],
    categories: new Set(['visual-theme']) as ReadonlySet<import('../../src/design/types.js').DesignCategory>,
    tokens: [],
    rules: [],
  };
}

function makeInput(overrides: Partial<{ task: string; env: Record<string, string> }> = {}) {
  return {
    teamName: 'test-team',
    task: overrides.task ?? 'Fix the bug',
    cwd: '/tmp/fake-cwd',
    workers: 1,
    env: overrides.env ?? {},
  };
}

/** Extract the string passed to writeFile */
function capturedContent(): string {
  const calls = writeFileMock.mock.calls;
  if (calls.length === 0) throw new Error('writeFile was never called');
  // signature: writeFile(path, content, encoding)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return calls.at(-1)![1] as string;
}

describe('integration: design context injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to safe defaults before each test
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    loadLearnedPatternsMock.mockResolvedValue([]);
    loadProjectMemoryMock.mockResolvedValue({
      schemaVersion: 1 as const,
      updatedAt: new Date().toISOString(),
      directives: [],
      notes: [],
      hotPaths: [],
      recentTasks: [],
      learnedSkillIds: [],
    });
    formatProjectMemorySummaryMock.mockReturnValue('');
    listCanonicalRoleSkillMappingsMock.mockReturnValue([]);
    delete process.env['OMP_DESIGN_CONTEXT_ENABLED'];
  });

  afterEach(() => {
    delete process.env['OMP_DESIGN_CONTEXT_ENABLED'];
  });

  test('Flag ON + DESIGN.md present: written content contains Design System section', async () => {
    process.env['OMP_DESIGN_CONTEXT_ENABLED'] = '1';

    const system = makeDesignSystem();
    loadDesignMdMock.mockResolvedValue({
      path: '/tmp/fake-cwd/DESIGN.md',
      system,
    });

    await writeWorkerContext(makeInput());

    const content = capturedContent();
    expect(content).toContain('Design System');
    // The tier-1 summary includes the category name
    expect(content).toContain('DESIGN.md');
  });

  test('Flag OFF + DESIGN.md present: written content does NOT contain Design System section', async () => {
    // Do not set OMP_DESIGN_CONTEXT_ENABLED

    const system = makeDesignSystem();
    loadDesignMdMock.mockResolvedValue({
      path: '/tmp/fake-cwd/DESIGN.md',
      system,
    });

    await writeWorkerContext(makeInput());

    const content = capturedContent();
    expect(content).not.toContain('## Design System');
  });

  test('Flag ON + DESIGN.md absent + non-UI task: no design section and no warning', async () => {
    process.env['OMP_DESIGN_CONTEXT_ENABLED'] = '1';
    loadDesignMdMock.mockResolvedValue(null);

    await writeWorkerContext(makeInput({ task: 'Fix database connection pooling' }));

    const content = capturedContent();
    expect(content).not.toContain('## Design System');
    expect(content).not.toContain('UI-related task detected');
  });

  test('Flag ON + DESIGN.md absent + UI task: smart warning is included', async () => {
    process.env['OMP_DESIGN_CONTEXT_ENABLED'] = '1';
    loadDesignMdMock.mockResolvedValue(null);

    await writeWorkerContext(makeInput({ task: 'Add React component for user profile' }));

    const content = capturedContent();
    expect(content).toContain('UI-related task detected');
    expect(content).toContain('DESIGN.md');
  });

  test('Flag ON + loadDesignMd throws: graceful degradation — content written without design section', async () => {
    process.env['OMP_DESIGN_CONTEXT_ENABLED'] = '1';
    loadDesignMdMock.mockRejectedValue(new Error('parse failure'));

    // Should not throw — degradation is silent
    await expect(writeWorkerContext(makeInput())).resolves.toBeUndefined();

    const content = capturedContent();
    expect(content).not.toContain('## Design System');
    // Core content still present
    expect(content).toContain('oh-my-product Team Context');
  });

  test('Budget overflow: design section dropped first, skill catalog preserved', async () => {
    process.env['OMP_DESIGN_CONTEXT_ENABLED'] = '1';

    const system = makeDesignSystem();
    loadDesignMdMock.mockResolvedValue({
      path: '/tmp/fake-cwd/DESIGN.md',
      system,
    });

    // Fill skill lines so that adding the wrapped design section tips over the 16 KB limit
    // but dropping it brings the total back under. Calibrated at 211 mappings (~90 bytes each).
    const manyMappings = Array.from({ length: 211 }, (_, i) => ({
      skill: `skill-${i}`,
      aliases: [],
      primaryRoleId: 'executor',
      fallbackRoleIds: ['debugger'],
    }));
    listCanonicalRoleSkillMappingsMock.mockReturnValue(manyMappings);

    await writeWorkerContext(makeInput());

    const content = capturedContent();
    // Overall content must still be within the hard 16 KB limit
    expect(Buffer.byteLength(content, 'utf8')).toBeLessThanOrEqual(16 * 1024);
    // Design section was the first thing dropped to reclaim space
    expect(content).not.toContain('## Design System');
    // Skill catalog lines are present (skills survive the first drop)
    expect(content).toContain('`skill-0`');
  });
});
