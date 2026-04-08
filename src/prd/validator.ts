import type { PrdDocument, PrdUserStory } from './parser.js';

export type PrdValidationIssueSeverity = 'error' | 'warning';

export type PrdValidationIssueCode =
  | 'OMP_PRD_VALIDATE_INVALID_DOCUMENT'
  | 'OMP_PRD_VALIDATE_STORIES_REQUIRED'
  | 'OMP_PRD_VALIDATE_STORY_DUPLICATE_ID'
  | 'OMP_PRD_VALIDATE_STORY_DUPLICATE_PRIORITY'
  | 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD'
  | 'OMP_PRD_VALIDATE_STORY_ACCEPTANCE_REQUIRED'
  | 'OMP_PRD_VALIDATE_STORY_DUPLICATE_CRITERION_ID'
  | 'OMP_PRD_VALIDATE_STORY_DUPLICATE_CRITERION_TEXT';

export interface PrdValidationIssue {
  code: PrdValidationIssueCode;
  path: string;
  message: string;
  severity: PrdValidationIssueSeverity;
}

export interface PrdValidationOptions {
  requireStories?: boolean;
  requireAcceptanceCriteriaPerStory?: boolean;
  allowDuplicatePriorities?: boolean;
}

export interface PrdValidationMetadata {
  storyCount: number;
  completedStoryCount: number;
  pendingStoryCount: number;
  acceptanceCriteriaCount: number;
}

export interface PrdValidationResult {
  valid: boolean;
  issues: PrdValidationIssue[];
  metadata: PrdValidationMetadata;
}

export type AcceptanceCriterionResultValue =
  | boolean
  | 'PASS'
  | 'FAIL'
  | 'UNKNOWN';

export interface AcceptanceCriteriaValidationResult {
  valid: boolean;
  totalCriteria: number;
  passedCriteria: number;
  missingCriterionIds: string[];
  failedCriterionIds: string[];
  unknownCriterionIds: string[];
}

function normalizeCriterionResult(value: AcceptanceCriterionResultValue | undefined):
  | 'PASS'
  | 'FAIL'
  | 'UNKNOWN' {
  if (value === true || value === 'PASS') {
    return 'PASS';
  }

  if (value === false || value === 'FAIL') {
    return 'FAIL';
  }

  return 'UNKNOWN';
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeCriterionId(value: string): string {
  return value.trim().toLowerCase();
}

function createMetadata(prd?: PrdDocument | null): PrdValidationMetadata {
  if (!prd) {
    return {
      storyCount: 0,
      completedStoryCount: 0,
      pendingStoryCount: 0,
      acceptanceCriteriaCount: 0,
    };
  }

  const storyCount = prd.userStories.length;
  const completedStoryCount = prd.userStories.filter((story) => story.passes).length;
  const acceptanceCriteriaCount = prd.userStories.reduce(
    (acc, story) => acc + story.acceptanceCriteria.length,
    0,
  );

  return {
    storyCount,
    completedStoryCount,
    pendingStoryCount: storyCount - completedStoryCount,
    acceptanceCriteriaCount,
  };
}

export function validateAcceptanceCriteria(
  story: PrdUserStory,
  criterionResults: Record<string, AcceptanceCriterionResultValue | undefined>,
): AcceptanceCriteriaValidationResult {
  const missingCriterionIds: string[] = [];
  const failedCriterionIds: string[] = [];
  const unknownCriterionIds: string[] = [];
  const normalizedCriterionResults = new Map<string, AcceptanceCriterionResultValue | undefined>();

  for (const [criterionId, result] of Object.entries(criterionResults)) {
    const normalizedId = normalizeCriterionId(criterionId);
    if (!normalizedId) {
      continue;
    }

    normalizedCriterionResults.set(normalizedId, result);
  }

  let passedCriteria = 0;

  for (const criterion of story.acceptanceCriteria) {
    const normalizedCriterionId = normalizeCriterionId(criterion.id);
    const hasResult = normalizedCriterionResults.has(normalizedCriterionId);
    const rawResult = normalizedCriterionResults.get(normalizedCriterionId);
    const result = normalizeCriterionResult(rawResult);

    if (result === 'PASS') {
      passedCriteria += 1;
      continue;
    }

    if (result === 'FAIL') {
      failedCriterionIds.push(criterion.id);
      continue;
    }

    if (!hasResult) {
      missingCriterionIds.push(criterion.id);
      continue;
    }

    unknownCriterionIds.push(criterion.id);
  }

  return {
    valid:
      missingCriterionIds.length === 0 &&
      failedCriterionIds.length === 0 &&
      unknownCriterionIds.length === 0,
    totalCriteria: story.acceptanceCriteria.length,
    passedCriteria,
    missingCriterionIds,
    failedCriterionIds,
    unknownCriterionIds,
  };
}

export function validatePrdDocument(
  prd: PrdDocument | null | undefined,
  options: PrdValidationOptions = {},
): PrdValidationResult {
  const issues: PrdValidationIssue[] = [];

  if (!prd) {
    return {
      valid: false,
      issues: [
        {
          code: 'OMP_PRD_VALIDATE_INVALID_DOCUMENT',
          path: '$',
          message: 'PRD document is required.',
          severity: 'error',
        },
      ],
      metadata: createMetadata(prd),
    };
  }

  const requireStories = options.requireStories !== false;
  const requireAcceptanceCriteria =
    options.requireAcceptanceCriteriaPerStory !== false;
  const allowDuplicatePriorities = options.allowDuplicatePriorities === true;

  if (requireStories && prd.userStories.length === 0) {
    issues.push({
      code: 'OMP_PRD_VALIDATE_STORIES_REQUIRED',
      path: 'userStories',
      message: 'At least one user story is required.',
      severity: 'error',
    });
  }

  const seenStoryIds = new Set<string>();
  const seenPriorities = new Map<number, string>();

  prd.userStories.forEach((story, index) => {
    const storyPath = `userStories[${index}]`;

    if (!story.id.trim()) {
      issues.push({
        code: 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD',
        path: `${storyPath}.id`,
        message: 'Story id must be a non-empty string.',
        severity: 'error',
      });
    }

    const normalizedId = story.id.trim().toLowerCase();
    if (normalizedId) {
      if (seenStoryIds.has(normalizedId)) {
        issues.push({
          code: 'OMP_PRD_VALIDATE_STORY_DUPLICATE_ID',
          path: `${storyPath}.id`,
          message: `Duplicate story id: ${story.id}`,
          severity: 'error',
        });
      }
      seenStoryIds.add(normalizedId);
    }

    if (!story.title.trim()) {
      issues.push({
        code: 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD',
        path: `${storyPath}.title`,
        message: 'Story title must be a non-empty string.',
        severity: 'error',
      });
    }

    if (!story.description.trim()) {
      issues.push({
        code: 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD',
        path: `${storyPath}.description`,
        message: 'Story description must be a non-empty string.',
        severity: 'error',
      });
    }

    if (!Number.isInteger(story.priority) || story.priority < 1) {
      issues.push({
        code: 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD',
        path: `${storyPath}.priority`,
        message: 'Story priority must be an integer >= 1.',
        severity: 'error',
      });
    }

    if (!allowDuplicatePriorities && Number.isInteger(story.priority)) {
      const existingPath = seenPriorities.get(story.priority);
      if (existingPath) {
        issues.push({
          code: 'OMP_PRD_VALIDATE_STORY_DUPLICATE_PRIORITY',
          path: `${storyPath}.priority`,
          message: `Priority ${story.priority} conflicts with ${existingPath}.`,
          severity: 'error',
        });
      } else {
        seenPriorities.set(story.priority, storyPath);
      }
    }

    if (requireAcceptanceCriteria && story.acceptanceCriteria.length === 0) {
      issues.push({
        code: 'OMP_PRD_VALIDATE_STORY_ACCEPTANCE_REQUIRED',
        path: `${storyPath}.acceptanceCriteria`,
        message: 'Each story must define at least one acceptance criterion.',
        severity: 'error',
      });
    }

    const seenCriterionIds = new Set<string>();
    const seenCriterionTexts = new Set<string>();

    story.acceptanceCriteria.forEach((criterion, criterionIndex) => {
      const criterionPath = `${storyPath}.acceptanceCriteria[${criterionIndex}]`;

      if (!criterion.id.trim()) {
        issues.push({
          code: 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD',
          path: `${criterionPath}.id`,
          message: 'Acceptance criterion id must be non-empty.',
          severity: 'error',
        });
      }

      const normalizedCriterionId = criterion.id.trim().toLowerCase();
      if (normalizedCriterionId) {
        if (seenCriterionIds.has(normalizedCriterionId)) {
          issues.push({
            code: 'OMP_PRD_VALIDATE_STORY_DUPLICATE_CRITERION_ID',
            path: `${criterionPath}.id`,
            message: `Duplicate acceptance criterion id in story ${story.id}: ${criterion.id}`,
            severity: 'error',
          });
        }
        seenCriterionIds.add(normalizedCriterionId);
      }

      if (!criterion.text.trim()) {
        issues.push({
          code: 'OMP_PRD_VALIDATE_STORY_INVALID_FIELD',
          path: `${criterionPath}.text`,
          message: 'Acceptance criterion text must be non-empty.',
          severity: 'error',
        });
      }

      const normalizedCriterionText = normalizeText(criterion.text);
      if (normalizedCriterionText) {
        if (seenCriterionTexts.has(normalizedCriterionText)) {
          issues.push({
            code: 'OMP_PRD_VALIDATE_STORY_DUPLICATE_CRITERION_TEXT',
            path: `${criterionPath}.text`,
            message: `Duplicate acceptance criterion text in story ${story.id}.`,
            severity: 'warning',
          });
        }
        seenCriterionTexts.add(normalizedCriterionText);
      }
    });
  });

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
    metadata: createMetadata(prd),
  };
}
