import type {
  PrdDocument,
  PrdUserStory,
} from './parser.js';
import {
  validateAcceptanceCriteria,
  validatePrdDocument,
  type AcceptanceCriterionResultValue,
  type AcceptanceCriteriaValidationResult,
  type PrdValidationResult,
} from './validator.js';

export interface PrdStatus {
  total: number;
  completed: number;
  pending: number;
  allComplete: boolean;
  nextStory: PrdUserStory | null;
  incompleteIds: string[];
}

export interface CompleteStoryInput {
  storyId: string;
  criterionResults?: Record<string, AcceptanceCriterionResultValue | undefined>;
  notes?: string;
  allowCriteriaBypass?: boolean;
}

export interface PrdWorkflowResult {
  ok: boolean;
  prd: PrdDocument;
  status: PrdStatus;
  validation: PrdValidationResult;
  acceptanceValidation?: AcceptanceCriteriaValidationResult;
  reason?: string;
}

export function getPrdStatus(prd: PrdDocument): PrdStatus {
  const completedStories = prd.userStories.filter((story) => story.passes);
  const pendingStories = prd.userStories.filter((story) => !story.passes);

  const sortedPendingStories = [...pendingStories].sort((a, b) => {
    if (a.priority === b.priority) {
      return a.id.localeCompare(b.id);
    }

    return a.priority - b.priority;
  });

  return {
    total: prd.userStories.length,
    completed: completedStories.length,
    pending: pendingStories.length,
    allComplete: pendingStories.length === 0,
    nextStory: sortedPendingStories[0] ?? null,
    incompleteIds: pendingStories.map((story) => story.id),
  };
}

export function getStoryById(
  prd: PrdDocument,
  storyId: string,
): PrdUserStory | null {
  const normalized = storyId.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const story of prd.userStories) {
    if (story.id.trim().toLowerCase() === normalized) {
      return story;
    }
  }

  return null;
}

export function getNextStory(prd: PrdDocument): PrdUserStory | null {
  return getPrdStatus(prd).nextStory;
}

function clonePrd(prd: PrdDocument): PrdDocument {
  return {
    ...prd,
    userStories: prd.userStories.map((story) => ({
      ...story,
      acceptanceCriteria: story.acceptanceCriteria.map((criterion) => ({ ...criterion })),
    })),
  };
}

export function completeStory(
  prd: PrdDocument,
  input: CompleteStoryInput,
): PrdWorkflowResult {
  const nextPrd = clonePrd(prd);
  const validation = validatePrdDocument(nextPrd);

  if (!validation.valid) {
    return {
      ok: false,
      prd: nextPrd,
      status: getPrdStatus(nextPrd),
      validation,
      reason: 'PRD document is invalid; cannot mark story complete.',
    };
  }

  const story = getStoryById(nextPrd, input.storyId);
  if (!story) {
    return {
      ok: false,
      prd: nextPrd,
      status: getPrdStatus(nextPrd),
      validation,
      reason: `Story not found: ${input.storyId}`,
    };
  }

  const allowCriteriaBypass = input.allowCriteriaBypass === true;
  const criterionResults = input.criterionResults ?? {};
  const acceptanceValidation = validateAcceptanceCriteria(story, criterionResults);

  if (!allowCriteriaBypass && !acceptanceValidation.valid) {
    return {
      ok: false,
      prd: nextPrd,
      status: getPrdStatus(nextPrd),
      validation,
      acceptanceValidation,
      reason:
        'Acceptance criteria are not fully satisfied; story remains incomplete.',
    };
  }

  story.passes = true;
  if (typeof input.notes === 'string' && input.notes.trim().length > 0) {
    story.notes = input.notes.trim();
  }

  return {
    ok: true,
    prd: nextPrd,
    status: getPrdStatus(nextPrd),
    validation,
    acceptanceValidation,
  };
}

export function reopenStory(
  prd: PrdDocument,
  storyId: string,
  notes?: string,
): PrdWorkflowResult {
  const nextPrd = clonePrd(prd);
  const validation = validatePrdDocument(nextPrd);

  if (!validation.valid) {
    return {
      ok: false,
      prd: nextPrd,
      status: getPrdStatus(nextPrd),
      validation,
      reason: 'PRD document is invalid; cannot reopen story.',
    };
  }

  const story = getStoryById(nextPrd, storyId);
  if (!story) {
    return {
      ok: false,
      prd: nextPrd,
      status: getPrdStatus(nextPrd),
      validation,
      reason: `Story not found: ${storyId}`,
    };
  }

  story.passes = false;

  if (typeof notes === 'string' && notes.trim().length > 0) {
    story.notes = notes.trim();
  }

  return {
    ok: true,
    prd: nextPrd,
    status: getPrdStatus(nextPrd),
    validation,
  };
}

export function formatNextStoryPrompt(story: PrdUserStory): string {
  return [
    '<current-story>',
    '',
    `## Current Story: ${story.id} - ${story.title}`,
    '',
    story.description,
    '',
    '**Acceptance Criteria:**',
    ...story.acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion.text}`),
    '',
    '**Instructions:**',
    '1. Implement this story completely.',
    '2. Verify ALL acceptance criteria with fresh evidence.',
    '3. Run quality gates (typecheck/tests/verify).',
    '4. Mark story as passes=true only when criteria pass.',
    '',
    '</current-story>',
    '',
    '---',
    '',
  ].join('\n');
}
