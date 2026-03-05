import { describe, expect, test } from 'vitest';

import {
  completeStory,
  formatNextStoryPrompt,
  getNextStory,
  getPrdStatus,
  parsePrdJson,
  validateAcceptanceCriteria,
  validatePrdDocument,
  type PrdAcceptanceCriterion,
  type PrdDocument,
  type PrdUserStory,
} from '../../src/prd/index.js';

function createSamplePrd(): PrdDocument {
  return {
    project: 'oh-my-gemini',
    branchName: 'feature/prd-workflow',
    description: 'Add PRD workflow support.',
    userStories: [
      {
        id: 'US-001',
        title: 'Parser support',
        description: 'As a maintainer, I want parser support.',
        acceptanceCriteria: [
          { id: 'AC-US-001-1', text: 'Parses valid PRD JSON' },
          { id: 'AC-US-001-2', text: 'Returns actionable parse issues' },
        ],
        priority: 1,
        passes: false,
      },
      {
        id: 'US-002',
        title: 'Workflow support',
        description: 'As a maintainer, I want workflow helpers.',
        acceptanceCriteria: [
          { id: 'AC-US-002-1', text: 'Can read next story by priority' },
        ],
        priority: 2,
        passes: false,
      },
    ],
  };
}

function requireDefined<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${label} to exist in test fixture.`);
  }

  return value;
}

describe('reliability: prd workflow', () => {
  test('parser normalizes ralph-style PRD with string acceptance criteria', () => {
    const raw = JSON.stringify({
      project: 'oh-my-gemini',
      branchName: 'feature/prd',
      description: 'PRD parser test',
      userStories: [
        {
          id: 'US-001',
          title: 'Story 1',
          description: 'Build parser',
          acceptanceCriteria: ['Criterion A', 'Criterion B'],
          priority: 1,
          passes: false,
        },
      ],
    });

    const parsed = parsePrdJson(raw);

    expect(parsed.valid).toBe(true);
    expect(parsed.prd).not.toBeNull();

    const firstStory = requireDefined(parsed.prd?.userStories[0], 'first story');
    const firstCriterion = requireDefined<PrdAcceptanceCriterion>(
      firstStory.acceptanceCriteria[0],
      'first criterion',
    );
    const secondCriterion = requireDefined<PrdAcceptanceCriterion>(
      firstStory.acceptanceCriteria[1],
      'second criterion',
    );

    expect(firstCriterion.id).toBe('AC-US-001-1');
    expect(secondCriterion.text).toBe('Criterion B');
  });

  test('parser returns error for invalid json', () => {
    const parsed = parsePrdJson('{ not-json ');

    expect(parsed.valid).toBe(false);
    expect(parsed.prd).toBeNull();
    expect(parsed.issues[0]?.code).toBe('OMG_PRD_PARSE_INVALID_JSON');
  });

  test('validator fails on duplicate story ids and missing acceptance criteria', () => {
    const prd: PrdDocument = {
      project: 'oh-my-gemini',
      branchName: 'main',
      description: 'dup test',
      userStories: [
        {
          id: 'US-001',
          title: 'Story A',
          description: 'A',
          acceptanceCriteria: [],
          priority: 1,
          passes: false,
        },
        {
          id: 'US-001',
          title: 'Story B',
          description: 'B',
          acceptanceCriteria: [{ id: 'AC-1', text: 'ok' }],
          priority: 2,
          passes: false,
        },
      ],
    };

    const validation = validatePrdDocument(prd);
    const allIssues = validation.issues.map((issue) => issue.code);

    expect(validation.valid).toBe(false);
    expect(allIssues).toContain('OMG_PRD_VALIDATE_STORY_DUPLICATE_ID');
    expect(allIssues).toContain('OMG_PRD_VALIDATE_STORY_ACCEPTANCE_REQUIRED');
  });

  test('acceptance criteria validation reports missing and failed criteria', () => {
    const prd = createSamplePrd();
    const story = requireDefined<PrdUserStory>(prd.userStories[0], 'story US-001');

    const result = validateAcceptanceCriteria(story, {
      'AC-US-001-1': true,
      'AC-US-001-2': false,
    });

    expect(result.valid).toBe(false);
    expect(result.passedCriteria).toBe(1);
    expect(result.failedCriterionIds).toStrictEqual(['AC-US-001-2']);
  });

  test('completeStory blocks completion until all acceptance criteria pass', () => {
    const prd = createSamplePrd();

    const blocked = completeStory(prd, {
      storyId: 'US-001',
      criterionResults: {
        'AC-US-001-1': true,
      },
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/acceptance criteria/i);

    const blockedStory = requireDefined<PrdUserStory>(
      blocked.prd.userStories[0],
      'blocked story',
    );
    expect(blockedStory.passes).toBe(false);

    const completed = completeStory(prd, {
      storyId: 'US-001',
      criterionResults: {
        'AC-US-001-1': true,
        'AC-US-001-2': 'PASS',
      },
      notes: 'validated by reliability test',
    });

    expect(completed.ok).toBe(true);

    const completedStory = requireDefined<PrdUserStory>(
      completed.prd.userStories[0],
      'completed story',
    );
    expect(completedStory.passes).toBe(true);
    expect(completed.status.completed).toBe(1);
    expect(getNextStory(completed.prd)?.id).toBe('US-002');
  });

  test('status and next-story helpers remain deterministic by priority', () => {
    const prd = createSamplePrd();
    const status = getPrdStatus(prd);

    expect(status.total).toBe(2);
    expect(status.completed).toBe(0);
    expect(status.pending).toBe(2);
    expect(status.nextStory?.id).toBe('US-001');

    const prompt = formatNextStoryPrompt(
      requireDefined<PrdUserStory>(prd.userStories[0], 'prompt story'),
    );
    expect(prompt).toContain('Current Story: US-001');
    expect(prompt).toContain('Verify ALL acceptance criteria');
  });
});
