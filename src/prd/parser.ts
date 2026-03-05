export type PrdParseIssueSeverity = 'error' | 'warning';

export type PrdParseIssueCode =
  | 'OMG_PRD_PARSE_INVALID_JSON'
  | 'OMG_PRD_PARSE_INVALID_ROOT'
  | 'OMG_PRD_PARSE_FIELD_DEFAULTED'
  | 'OMG_PRD_PARSE_INVALID_STORIES'
  | 'OMG_PRD_PARSE_INVALID_STORY'
  | 'OMG_PRD_PARSE_INVALID_CRITERIA';

export interface PrdParseIssue {
  code: PrdParseIssueCode;
  path: string;
  message: string;
  severity: PrdParseIssueSeverity;
}

export interface PrdAcceptanceCriterion {
  id: string;
  text: string;
}

export interface PrdUserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: PrdAcceptanceCriterion[];
  priority: number;
  passes: boolean;
  notes?: string;
}

export interface PrdDocument {
  project: string;
  branchName: string;
  description: string;
  userStories: PrdUserStory[];
}

export interface PrdParseResult {
  prd: PrdDocument | null;
  valid: boolean;
  issues: PrdParseIssue[];
}

export interface PrdParseOptions {
  defaultProject?: string;
  defaultBranchName?: string;
  defaultDescription?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function defaultStoryId(index: number): string {
  return `US-${String(index + 1).padStart(3, '0')}`;
}

function normalizeStoryId(raw: unknown, index: number): string {
  const candidate = readNonEmptyString(raw);
  if (!candidate) {
    return defaultStoryId(index);
  }

  return candidate;
}

function defaultCriterionId(storyId: string, index: number): string {
  return `AC-${storyId}-${index + 1}`;
}

function normalizeCriterion(
  raw: unknown,
  storyId: string,
  criterionIndex: number,
): PrdAcceptanceCriterion | null {
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) {
      return null;
    }

    return {
      id: defaultCriterionId(storyId, criterionIndex),
      text,
    };
  }

  if (!isRecord(raw)) {
    return null;
  }

  const text = readNonEmptyString(raw.text);
  if (!text) {
    return null;
  }

  const id = readNonEmptyString(raw.id) ?? defaultCriterionId(storyId, criterionIndex);
  return {
    id,
    text,
  };
}

function normalizePriority(raw: unknown, index: number): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }

  return index + 1;
}

function normalizePasses(raw: unknown): boolean {
  return raw === true;
}

function normalizeStories(raw: unknown, issues: PrdParseIssue[]): PrdUserStory[] {
  if (!Array.isArray(raw)) {
    issues.push({
      code: 'OMG_PRD_PARSE_INVALID_STORIES',
      path: 'userStories',
      message: 'userStories must be an array. Using empty list.',
      severity: 'warning',
    });
    return [];
  }

  const stories: PrdUserStory[] = [];

  raw.forEach((storyRaw, index) => {
    const pathPrefix = `userStories[${index}]`;
    if (!isRecord(storyRaw)) {
      issues.push({
        code: 'OMG_PRD_PARSE_INVALID_STORY',
        path: pathPrefix,
        message: 'Story entry must be an object. Skipped.',
        severity: 'warning',
      });
      return;
    }

    const id = normalizeStoryId(storyRaw.id, index);
    const title = readNonEmptyString(storyRaw.title) ?? `Story ${index + 1}`;
    const description =
      readNonEmptyString(storyRaw.description) ??
      'As a user, I want this story implemented.';
    const priority = normalizePriority(storyRaw.priority, index);
    const passes = normalizePasses(storyRaw.passes);
    const notes = readNonEmptyString(storyRaw.notes);

    if (!readNonEmptyString(storyRaw.id)) {
      issues.push({
        code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
        path: `${pathPrefix}.id`,
        message: `Missing story id. Defaulted to ${id}.`,
        severity: 'warning',
      });
    }

    if (!readNonEmptyString(storyRaw.title)) {
      issues.push({
        code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
        path: `${pathPrefix}.title`,
        message: `Missing story title. Defaulted to "${title}".`,
        severity: 'warning',
      });
    }

    if (!readNonEmptyString(storyRaw.description)) {
      issues.push({
        code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
        path: `${pathPrefix}.description`,
        message: 'Missing story description. Applied generic description.',
        severity: 'warning',
      });
    }

    if (!(typeof storyRaw.priority === 'number' && Number.isInteger(storyRaw.priority) && storyRaw.priority >= 1)) {
      issues.push({
        code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
        path: `${pathPrefix}.priority`,
        message: `Invalid priority. Defaulted to ${priority}.`,
        severity: 'warning',
      });
    }

    if (typeof storyRaw.passes !== 'boolean') {
      issues.push({
        code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
        path: `${pathPrefix}.passes`,
        message: 'Invalid passes flag. Defaulted to false.',
        severity: 'warning',
      });
    }

    const criteriaRaw = storyRaw.acceptanceCriteria;
    const acceptanceCriteria: PrdAcceptanceCriterion[] = [];

    if (!Array.isArray(criteriaRaw)) {
      issues.push({
        code: 'OMG_PRD_PARSE_INVALID_CRITERIA',
        path: `${pathPrefix}.acceptanceCriteria`,
        message: 'acceptanceCriteria must be an array. Using empty list.',
        severity: 'warning',
      });
    } else {
      criteriaRaw.forEach((criterionRaw, criterionIndex) => {
        const normalized = normalizeCriterion(criterionRaw, id, criterionIndex);
        if (!normalized) {
          issues.push({
            code: 'OMG_PRD_PARSE_INVALID_CRITERIA',
            path: `${pathPrefix}.acceptanceCriteria[${criterionIndex}]`,
            message: 'Acceptance criterion must be a non-empty string or { id?, text } object. Entry skipped.',
            severity: 'warning',
          });
          return;
        }

        acceptanceCriteria.push(normalized);
      });
    }

    stories.push({
      id,
      title,
      description,
      acceptanceCriteria,
      priority,
      passes,
      ...(notes ? { notes } : {}),
    });
  });

  return stories;
}

export function parsePrdObject(
  raw: unknown,
  options: PrdParseOptions = {},
): PrdParseResult {
  const issues: PrdParseIssue[] = [];

  if (!isRecord(raw)) {
    return {
      prd: null,
      valid: false,
      issues: [
        {
          code: 'OMG_PRD_PARSE_INVALID_ROOT',
          path: '$',
          message: 'PRD root must be an object.',
          severity: 'error',
        },
      ],
    };
  }

  const project =
    readNonEmptyString(raw.project) ??
    options.defaultProject ??
    'unnamed-project';
  const branchName =
    readNonEmptyString(raw.branchName) ??
    options.defaultBranchName ??
    'main';
  const description =
    readNonEmptyString(raw.description) ??
    options.defaultDescription ??
    'No PRD description provided.';

  if (!readNonEmptyString(raw.project)) {
    issues.push({
      code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
      path: 'project',
      message: `Missing project. Defaulted to "${project}".`,
      severity: 'warning',
    });
  }

  if (!readNonEmptyString(raw.branchName)) {
    issues.push({
      code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
      path: 'branchName',
      message: `Missing branchName. Defaulted to "${branchName}".`,
      severity: 'warning',
    });
  }

  if (!readNonEmptyString(raw.description)) {
    issues.push({
      code: 'OMG_PRD_PARSE_FIELD_DEFAULTED',
      path: 'description',
      message: 'Missing description. Applied fallback description.',
      severity: 'warning',
    });
  }

  const userStories = normalizeStories(raw.userStories, issues);

  const prd: PrdDocument = {
    project,
    branchName,
    description,
    userStories,
  };

  return {
    prd,
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

export function parsePrdJson(
  rawContent: string,
  options: PrdParseOptions = {},
): PrdParseResult {
  try {
    const parsed = JSON.parse(rawContent) as unknown;
    return parsePrdObject(parsed, options);
  } catch {
    return {
      prd: null,
      valid: false,
      issues: [
        {
          code: 'OMG_PRD_PARSE_INVALID_JSON',
          path: '$',
          message: 'Invalid JSON. Could not parse PRD content.',
          severity: 'error',
        },
      ],
    };
  }
}
