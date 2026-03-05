import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  completeStory,
  getNextStory,
  getPrdStatus,
  parsePrdJson,
  reopenStory,
  validatePrdDocument,
  type AcceptanceCriterionResultValue,
  type PrdDocument,
} from '../../prd/index.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
  readBooleanOption,
} from './arg-utils.js';

const DEFAULT_PRD_FILE_CANDIDATES = ['prd.json', '.omg/prd.json'] as const;

interface PrdCommandContext {
  cwd: string;
  io: CliIo;
}

interface LoadedPrdDocument {
  filePath: string;
  prd: PrdDocument;
  parseIssues: Array<{ path: string; message: string; severity: string }>;
  validation: ReturnType<typeof validatePrdDocument>;
}

function printPrdHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg prd <subcommand> [options]',
    '',
    'Subcommands:',
    '  init       Initialize a Ralph-style prd.json scaffold',
    '  status     Print PRD progress status',
    '  next       Print next incomplete story',
    '  validate   Validate PRD structure and acceptance definitions',
    '  complete   Mark a story complete with acceptance criteria evidence',
    '  reopen     Reopen a completed story',
    '',
    'Common options:',
    '  --file <path>  PRD JSON path (default: prd.json, then .omg/prd.json)',
    '  --json         Print machine-readable output',
    '  --help         Show command help',
  ].join('\n'));
}

function normalizeCriterionResultValue(
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

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePrdFilePath(
  cwd: string,
  explicitFile: string | undefined,
  requireExisting = true,
): Promise<string | null> {
  if (explicitFile) {
    const resolved = path.resolve(cwd, explicitFile);
    if (!requireExisting || (await pathExists(resolved))) {
      return resolved;
    }
    return null;
  }

  for (const candidate of DEFAULT_PRD_FILE_CANDIDATES) {
    const resolved = path.resolve(cwd, candidate);
    if (await pathExists(resolved)) {
      return resolved;
    }
  }

  if (!requireExisting) {
    return path.resolve(cwd, DEFAULT_PRD_FILE_CANDIDATES[0]);
  }

  return null;
}

async function loadPrdDocument(
  cwd: string,
  explicitFile: string | undefined,
): Promise<LoadedPrdDocument | null> {
  const filePath = await resolvePrdFilePath(cwd, explicitFile, true);
  if (!filePath) {
    return null;
  }

  const rawContent = await fs.readFile(filePath, 'utf8');
  const parseResult = parsePrdJson(rawContent);
  if (!parseResult.prd || !parseResult.valid) {
    throw new Error(
      `Failed to parse PRD JSON at ${filePath}: ${parseResult.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(' | ')}`,
    );
  }

  const validation = validatePrdDocument(parseResult.prd);
  return {
    filePath,
    prd: parseResult.prd,
    parseIssues: parseResult.issues,
    validation,
  };
}

function buildSimplePrd(params: {
  cwd: string;
  project?: string;
  branchName?: string;
  description?: string;
  task?: string;
}): PrdDocument {
  const task = (params.task ?? params.description ?? 'Implement requested feature').trim();
  const title = task.slice(0, 50) + (task.length > 50 ? '...' : '');
  const project = (params.project ?? (path.basename(params.cwd) || 'oh-my-gemini')).trim();
  const branchName = (params.branchName ?? 'main').trim();
  const description = (params.description ?? task).trim();

  return {
    project,
    branchName,
    description,
    userStories: [
      {
        id: 'US-001',
        title,
        description: task,
        acceptanceCriteria: [
          { id: 'AC-US-001-1', text: 'Implementation is complete' },
          { id: 'AC-US-001-2', text: 'Code compiles/runs without errors' },
          { id: 'AC-US-001-3', text: 'Tests pass (if applicable)' },
          { id: 'AC-US-001-4', text: 'Changes are committed' },
        ],
        priority: 1,
        passes: false,
      },
    ],
  };
}

function parseCriteriaJsonOption(
  raw: string | undefined,
): Record<string, AcceptanceCriterionResultValue | undefined> {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('--criteria must be valid JSON object');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('--criteria must be a JSON object of criterionId -> PASS/FAIL/UNKNOWN/boolean');
  }

  const results: Record<string, AcceptanceCriterionResultValue | undefined> = {};
  for (const [criterionId, resultRaw] of Object.entries(parsed)) {
    const normalized = normalizeCriterionResultValue(resultRaw);
    if (normalized === undefined) {
      throw new Error(
        `Invalid --criteria value for "${criterionId}". Expected PASS/FAIL/UNKNOWN/true/false.`,
      );
    }
    results[criterionId] = normalized;
  }

  return results;
}

function printPayload(
  io: CliIo,
  json: boolean,
  payload: Record<string, unknown>,
): void {
  if (json) {
    io.stdout(JSON.stringify(payload, null, 2));
    return;
  }

  const message = typeof payload.message === 'string' ? payload.message : JSON.stringify(payload);
  io.stdout(message);
}

async function executePrdInitSubcommand(
  parsed: ReturnType<typeof parseCliArgs>,
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  const unknown = findUnknownOptions(parsed.options, [
    'file',
    'project',
    'branch',
    'description',
    'task',
    'force',
    'json',
  ]);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const filePath = await resolvePrdFilePath(
    context.cwd,
    getStringOption(parsed.options, ['file']),
    false,
  );
  if (!filePath) {
    context.io.stderr('Unable to resolve PRD file path.');
    return { exitCode: 1 };
  }

  const force = readBooleanOption(parsed.options, ['force'], false);
  if (!force && (await pathExists(filePath))) {
    context.io.stderr(`PRD file already exists at ${filePath}. Use --force to overwrite.`);
    return { exitCode: 1 };
  }

  const prd = buildSimplePrd({
    cwd: context.cwd,
    project: getStringOption(parsed.options, ['project']),
    branchName: getStringOption(parsed.options, ['branch']),
    description: getStringOption(parsed.options, ['description']),
    task: getStringOption(parsed.options, ['task']),
  });

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(prd, null, 2)}\n`, 'utf8');

  printPayload(context.io, hasFlag(parsed.options, ['json']), {
    ok: true,
    message: `Initialized PRD at ${filePath}`,
    filePath,
    storyCount: prd.userStories.length,
  });
  return { exitCode: 0 };
}

async function executePrdStatusSubcommand(
  parsed: ReturnType<typeof parseCliArgs>,
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  const unknown = findUnknownOptions(parsed.options, ['file', 'json']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const loaded = await loadPrdDocument(context.cwd, getStringOption(parsed.options, ['file']));
  if (!loaded) {
    context.io.stderr('No PRD file found. Checked prd.json and .omg/prd.json.');
    return { exitCode: 1 };
  }

  const status = getPrdStatus(loaded.prd);
  const payload = {
    ok: loaded.validation.valid,
    message: `PRD ${status.completed}/${status.total} complete (${status.pending} pending).`,
    filePath: loaded.filePath,
    status,
    validation: loaded.validation,
    parseIssues: loaded.parseIssues,
  };

  printPayload(context.io, hasFlag(parsed.options, ['json']), payload);
  return { exitCode: loaded.validation.valid ? 0 : 1 };
}

async function executePrdNextSubcommand(
  parsed: ReturnType<typeof parseCliArgs>,
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  const unknown = findUnknownOptions(parsed.options, ['file', 'json']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const loaded = await loadPrdDocument(context.cwd, getStringOption(parsed.options, ['file']));
  if (!loaded) {
    context.io.stderr('No PRD file found. Checked prd.json and .omg/prd.json.');
    return { exitCode: 1 };
  }

  const nextStory = getNextStory(loaded.prd);
  const payload = nextStory
    ? {
        ok: true,
        message: `Next story: ${nextStory.id} - ${nextStory.title}`,
        filePath: loaded.filePath,
        nextStory,
      }
    : {
        ok: true,
        message: 'All stories are complete.',
        filePath: loaded.filePath,
        nextStory: null,
      };

  printPayload(context.io, hasFlag(parsed.options, ['json']), payload);
  return { exitCode: 0 };
}

async function executePrdValidateSubcommand(
  parsed: ReturnType<typeof parseCliArgs>,
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  const unknown = findUnknownOptions(parsed.options, ['file', 'json']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const loaded = await loadPrdDocument(context.cwd, getStringOption(parsed.options, ['file']));
  if (!loaded) {
    context.io.stderr('No PRD file found. Checked prd.json and .omg/prd.json.');
    return { exitCode: 1 };
  }

  const payload = {
    ok: loaded.validation.valid,
    message: loaded.validation.valid ? 'PRD validation passed.' : 'PRD validation failed.',
    filePath: loaded.filePath,
    validation: loaded.validation,
    parseIssues: loaded.parseIssues,
  };
  printPayload(context.io, hasFlag(parsed.options, ['json']), payload);
  return { exitCode: loaded.validation.valid ? 0 : 1 };
}

async function executePrdCompleteSubcommand(
  parsed: ReturnType<typeof parseCliArgs>,
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  const unknown = findUnknownOptions(parsed.options, [
    'file',
    'story',
    'criteria',
    'notes',
    'allow-criteria-bypass',
    'json',
  ]);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const storyId = getStringOption(parsed.options, ['story']);
  if (!storyId) {
    context.io.stderr('--story is required for `omg prd complete`.');
    return { exitCode: 2 };
  }

  let criteriaResults: Record<string, AcceptanceCriterionResultValue | undefined>;
  try {
    criteriaResults = parseCriteriaJsonOption(getStringOption(parsed.options, ['criteria']));
  } catch (error) {
    context.io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const loaded = await loadPrdDocument(context.cwd, getStringOption(parsed.options, ['file']));
  if (!loaded) {
    context.io.stderr('No PRD file found. Checked prd.json and .omg/prd.json.');
    return { exitCode: 1 };
  }

  const result = completeStory(loaded.prd, {
    storyId,
    criterionResults: criteriaResults,
    notes: getStringOption(parsed.options, ['notes']),
    allowCriteriaBypass: readBooleanOption(parsed.options, ['allow-criteria-bypass'], false),
  });

  if (!result.ok) {
    printPayload(context.io, hasFlag(parsed.options, ['json']), {
      ok: false,
      message: result.reason ?? 'Failed to complete story.',
      filePath: loaded.filePath,
      status: result.status,
      validation: result.validation,
      acceptanceValidation: result.acceptanceValidation,
    });
    return { exitCode: 1 };
  }

  await fs.writeFile(loaded.filePath, `${JSON.stringify(result.prd, null, 2)}\n`, 'utf8');
  printPayload(context.io, hasFlag(parsed.options, ['json']), {
    ok: true,
    message: `Story ${storyId} marked complete.`,
    filePath: loaded.filePath,
    status: result.status,
  });
  return { exitCode: 0 };
}

async function executePrdReopenSubcommand(
  parsed: ReturnType<typeof parseCliArgs>,
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  const unknown = findUnknownOptions(parsed.options, ['file', 'story', 'notes', 'json']);
  if (unknown.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(', ')}`);
    return { exitCode: 2 };
  }

  const storyId = getStringOption(parsed.options, ['story']);
  if (!storyId) {
    context.io.stderr('--story is required for `omg prd reopen`.');
    return { exitCode: 2 };
  }

  const loaded = await loadPrdDocument(context.cwd, getStringOption(parsed.options, ['file']));
  if (!loaded) {
    context.io.stderr('No PRD file found. Checked prd.json and .omg/prd.json.');
    return { exitCode: 1 };
  }

  const result = reopenStory(loaded.prd, storyId, getStringOption(parsed.options, ['notes']));
  if (!result.ok) {
    printPayload(context.io, hasFlag(parsed.options, ['json']), {
      ok: false,
      message: result.reason ?? 'Failed to reopen story.',
      filePath: loaded.filePath,
      status: result.status,
      validation: result.validation,
    });
    return { exitCode: 1 };
  }

  await fs.writeFile(loaded.filePath, `${JSON.stringify(result.prd, null, 2)}\n`, 'utf8');
  printPayload(context.io, hasFlag(parsed.options, ['json']), {
    ok: true,
    message: `Story ${storyId} reopened.`,
    filePath: loaded.filePath,
    status: result.status,
  });
  return { exitCode: 0 };
}

export async function executePrdCommand(
  argv: string[],
  context: PrdCommandContext,
): Promise<CommandExecutionResult> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printPrdHelp(context.io);
    return { exitCode: 0 };
  }

  const [subcommand, ...subcommandArgs] = argv;
  const parsed = parseCliArgs(subcommandArgs);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printPrdHelp(context.io);
    return { exitCode: 0 };
  }

  try {
    switch (subcommand) {
      case 'init':
        return await executePrdInitSubcommand(parsed, context);
      case 'status':
        return await executePrdStatusSubcommand(parsed, context);
      case 'next':
        return await executePrdNextSubcommand(parsed, context);
      case 'validate':
        return await executePrdValidateSubcommand(parsed, context);
      case 'complete':
        return await executePrdCompleteSubcommand(parsed, context);
      case 'reopen':
        return await executePrdReopenSubcommand(parsed, context);
      default:
        context.io.stderr(
          `Unknown prd subcommand. Supported: init | status | next | validate | complete | reopen`,
        );
        return { exitCode: 2 };
    }
  } catch (error) {
    context.io.stderr(`PRD command failed: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}
