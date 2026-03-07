import type {
  PrdDocument,
  PrdUserStory,
} from './parser.js';
import { parsePrdObject } from './parser.js';
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

export interface PrdAcceptanceContractOptions {
  requireAllStoriesPassed?: boolean;
  requireCriterionResultsForPassedStories?: boolean;
}

export interface PrdAcceptanceContractReport {
  applicable: boolean;
  passed: boolean;
  summary: string;
  issues: string[];
  metadata: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAcceptanceResultValue(
  value: unknown,
): AcceptanceCriterionResultValue | undefined {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'PASS' || normalized === 'FAIL' || normalized === 'UNKNOWN') {
    return normalized;
  }

  return undefined;
}

function parseCriterionResultsByStory(
  raw: unknown,
): Map<string, Record<string, AcceptanceCriterionResultValue | undefined>> {
  const map = new Map<string, Record<string, AcceptanceCriterionResultValue | undefined>>();
  if (!isRecord(raw)) {
    return map;
  }

  for (const [storyId, resultsRaw] of Object.entries(raw)) {
    if (!isRecord(resultsRaw)) {
      continue;
    }

    const normalizedStoryId = storyId.trim().toLowerCase();
    if (!normalizedStoryId) {
      continue;
    }

    const criteriaResults: Record<string, AcceptanceCriterionResultValue | undefined> = {};
    for (const [criterionId, resultRaw] of Object.entries(resultsRaw)) {
      const normalizedCriterionId = criterionId.trim();
      if (!normalizedCriterionId) {
        continue;
      }

      criteriaResults[normalizedCriterionId] = normalizeAcceptanceResultValue(resultRaw);
    }

    map.set(normalizedStoryId, criteriaResults);
  }

  return map;
}

function summarizeAcceptanceValidationIssues(
  storyId: string,
  acceptanceValidation: AcceptanceCriteriaValidationResult,
): string[] {
  const issues: string[] = [];

  if (acceptanceValidation.missingCriterionIds.length > 0) {
    issues.push(
      `story ${storyId} is missing criterion results: ${acceptanceValidation.missingCriterionIds.join(', ')}`,
    );
  }

  if (acceptanceValidation.failedCriterionIds.length > 0) {
    issues.push(
      `story ${storyId} has failed criteria: ${acceptanceValidation.failedCriterionIds.join(', ')}`,
    );
  }

  if (acceptanceValidation.unknownCriterionIds.length > 0) {
    issues.push(
      `story ${storyId} has unknown criteria results: ${acceptanceValidation.unknownCriterionIds.join(', ')}`,
    );
  }

  return issues;
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
    incompleteIds: sortedPendingStories.map((story) => story.id),
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
    ...story.acceptanceCriteria.map(
      (criterion, index) => `${index + 1}. [${criterion.id}] ${criterion.text}`,
    ),
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

export function evaluatePrdAcceptanceContract(
  runtime: Record<string, unknown> | null | undefined,
  options: PrdAcceptanceContractOptions = {},
): PrdAcceptanceContractReport {
  if (!isRecord(runtime) || runtime.prd === undefined) {
    return {
      applicable: false,
      passed: true,
      summary: 'prd acceptance contract not applicable: runtime.prd is missing',
      issues: [],
      metadata: {
        applicable: false,
        storyCount: 0,
      },
    };
  }

  const parsed = parsePrdObject(runtime.prd);
  if (!parsed.prd || !parsed.valid) {
    const parseIssues = parsed.issues
      .map((issue) => `${issue.path}: ${issue.message}`);
    return {
      applicable: true,
      passed: false,
      summary: `prd acceptance contract failed: ${parseIssues.join(' | ') || 'invalid prd payload'}`,
      issues: parseIssues,
      metadata: {
        applicable: true,
        parseIssueCount: parsed.issues.length,
        parseErrorCount: parsed.issues.filter((issue) => issue.severity === 'error').length,
        storyCount: 0,
      },
    };
  }

  const requireAllStoriesPassed = options.requireAllStoriesPassed !== false;
  const requireCriterionResultsForPassedStories =
    options.requireCriterionResultsForPassedStories !== false;

  const validation = validatePrdDocument(parsed.prd);
  const issues = validation.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `${issue.path}: ${issue.message}`);

  const criteriaResultsByStory = parseCriterionResultsByStory(runtime.prdCriteriaResults);
  let checkedStoryCount = 0;
  let checkedCriteriaCount = 0;
  let passedCriteriaCount = 0;

  for (const story of parsed.prd.userStories) {
    if (requireAllStoriesPassed && !story.passes) {
      issues.push(`story ${story.id} is not marked passes=true`);
      continue;
    }

    if (!story.passes) {
      continue;
    }

    checkedStoryCount += 1;

    if (!requireCriterionResultsForPassedStories) {
      continue;
    }

    const storyCriteriaResults = criteriaResultsByStory.get(story.id.trim().toLowerCase());
    if (!storyCriteriaResults) {
      issues.push(`story ${story.id} is missing criterion results`);
      continue;
    }

    const acceptanceValidation = validateAcceptanceCriteria(story, storyCriteriaResults);
    checkedCriteriaCount += acceptanceValidation.totalCriteria;
    passedCriteriaCount += acceptanceValidation.passedCriteria;

    if (!acceptanceValidation.valid) {
      issues.push(
        ...summarizeAcceptanceValidationIssues(story.id, acceptanceValidation),
      );
    }
  }

  const passed = issues.length === 0;
  return {
    applicable: true,
    passed,
    summary: passed
      ? `prd acceptance contract passed for ${parsed.prd.userStories.length} story(s)`
      : `prd acceptance contract failed: ${issues.join(' | ')}`,
    issues,
    metadata: {
      applicable: true,
      parseIssueCount: parsed.issues.length,
      parseWarningCount: parsed.issues.filter((issue) => issue.severity === 'warning').length,
      validationIssueCount: validation.issues.length,
      storyCount: parsed.prd.userStories.length,
      checkedStoryCount,
      checkedCriteriaCount,
      passedCriteriaCount,
      requireAllStoriesPassed,
      requireCriterionResultsForPassedStories,
    },
  };
}
