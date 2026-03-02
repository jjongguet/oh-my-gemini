import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TeamSkillId, TeamSnapshot } from './types.js';
import { normalizeCanonicalSkillTokens } from './role-skill-mapping.js';

interface SelectedSubagentAssignment {
  id: string;
  role: string;
  workerId: string;
  primarySkill?: TeamSkillId;
}

export interface RoleOutputContractReport {
  applicable: boolean;
  passed: boolean;
  summary: string;
  issues: string[];
  metadata: Record<string, unknown>;
}

export interface RoleOutputContractOptions {
  requireArtifactEvidence?: boolean;
  cwd?: string;
  teamName?: string;
}

const ROLE_OUTPUT_STATUSES = new Set(['completed', 'failed', 'blocked']);
const VERIFICATION_RESULTS = new Set(['PASS', 'FAIL']);

interface ArtifactEvidenceState {
  enabled: boolean;
  rootPath?: string;
  checkedCount: number;
  passedCount: number;
  failedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => entry !== undefined);
}

function readArtifactRefs(output: Record<string, unknown>): string[] {
  const artifacts = output.artifacts;
  if (!isRecord(artifacts)) {
    return [];
  }

  return Object.values(artifacts)
    .map((value) => readString(value))
    .filter((value): value is string => value !== undefined);
}

function parseAssignmentPrimarySkill(entry: Record<string, unknown>): TeamSkillId | undefined {
  const rawSkillTokens = [
    ...readStringArray(entry.skills),
    ...(readString(entry.skill) ? [readString(entry.skill) as string] : []),
  ];

  const parsed = normalizeCanonicalSkillTokens(rawSkillTokens);
  return parsed.skills[0];
}

function parseAssignments(runtime: Record<string, unknown>): SelectedSubagentAssignment[] {
  const selectedRaw = runtime.selectedSubagents;
  if (!Array.isArray(selectedRaw)) {
    return [];
  }

  const parsed: SelectedSubagentAssignment[] = [];

  selectedRaw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      return;
    }

    const id = readString(entry.id);
    if (!id) {
      return;
    }

    const role = readString(entry.role) ?? id;
    const workerId = readString(entry.workerId) ?? `worker-${index + 1}`;
    const primarySkill = parseAssignmentPrimarySkill(entry);

    parsed.push({
      id: id.toLowerCase(),
      role: role.toLowerCase(),
      workerId,
      primarySkill,
    });
  });

  return parsed;
}

function findOutputForAssignment(
  outputs: Record<string, unknown>[],
  assignment: SelectedSubagentAssignment,
  usedIndexes: Set<number>,
): {
  output: Record<string, unknown>;
  index: number;
} | null {
  for (let index = 0; index < outputs.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    const output = outputs[index];
    if (!output) {
      continue;
    }

    const workerId = readString(output.workerId);
    const subagentId = readString(output.subagentId)?.toLowerCase();
    const roleId = readString(output.roleId)?.toLowerCase();

    if (workerId === assignment.workerId) {
      return { output, index };
    }
    if (subagentId === assignment.id) {
      return { output, index };
    }
    if (roleId === assignment.role) {
      return { output, index };
    }
  }

  return null;
}

function validateBaseRoleOutput(
  output: Record<string, unknown>,
  assignment: SelectedSubagentAssignment,
  issues: string[],
): {
  status: string | undefined;
  artifactRefs: string[];
} {
  const status = readString(output.status)?.toLowerCase();
  if (!status || !ROLE_OUTPUT_STATUSES.has(status)) {
    issues.push(
      `role output ${assignment.id} (${assignment.workerId}) has invalid status`,
    );
  }

  if (!readString(output.summary)) {
    issues.push(
      `role output ${assignment.id} (${assignment.workerId}) is missing summary`,
    );
  }

  const artifactRefs = readArtifactRefs(output);

  if (artifactRefs.length === 0) {
    issues.push(
      `role output ${assignment.id} (${assignment.workerId}) is missing artifact references`,
    );
  }

  return {
    status,
    artifactRefs,
  };
}

function validatePlannerOutput(
  output: Record<string, unknown>,
  assignment: SelectedSubagentAssignment,
  issues: string[],
): void {
  const plan = output.plan;
  if (!isRecord(plan)) {
    issues.push(
      `planner output ${assignment.workerId} is missing plan object`,
    );
    return;
  }

  if (readStringArray(plan.steps).length === 0) {
    issues.push(
      `planner output ${assignment.workerId} is missing plan.steps`,
    );
  }
}

function validateExecutorOutput(
  output: Record<string, unknown>,
  assignment: SelectedSubagentAssignment,
  issues: string[],
): void {
  const implementation = output.implementation;
  if (!isRecord(implementation)) {
    issues.push(
      `executor output ${assignment.workerId} is missing implementation object`,
    );
    return;
  }

  if (!readString(implementation.changeSummary)) {
    issues.push(
      `executor output ${assignment.workerId} is missing implementation.changeSummary`,
    );
  }

  if (readStringArray(implementation.commands).length === 0) {
    issues.push(
      `executor output ${assignment.workerId} is missing implementation.commands`,
    );
  }
}

function validateVerifierOutput(
  output: Record<string, unknown>,
  assignment: SelectedSubagentAssignment,
  issues: string[],
): void {
  const checksRaw = output.verification;
  if (!Array.isArray(checksRaw) || checksRaw.length === 0) {
    issues.push(
      `verifier output ${assignment.workerId} is missing verification checks`,
    );
    return;
  }

  checksRaw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push(
        `verifier output ${assignment.workerId} has invalid verification entry at index ${index}`,
      );
      return;
    }

    const name = readString(entry.name);
    const command = readString(entry.command);
    const result = readString(entry.result);

    if (!name || !command || !result || !VERIFICATION_RESULTS.has(result.toUpperCase())) {
      issues.push(
        `verifier output ${assignment.workerId} has invalid verification entry at index ${index}`,
      );
      return;
    }

    if (result.toUpperCase() !== 'PASS') {
      issues.push(
        `verifier output ${assignment.workerId} contains non-pass verification result at index ${index}`,
      );
    }
  });
}

function validateReviewerOutput(
  output: Record<string, unknown>,
  assignment: SelectedSubagentAssignment,
  issues: string[],
): void {
  const review = output.review;
  if (!isRecord(review)) {
    issues.push(
      `review output ${assignment.workerId} is missing review object`,
    );
    return;
  }

  if (readStringArray(review.findings).length === 0) {
    issues.push(
      `review output ${assignment.workerId} is missing review.findings`,
    );
  }
}

function validateHandoffOutput(
  output: Record<string, unknown>,
  assignment: SelectedSubagentAssignment,
  issues: string[],
): void {
  const handoff = output.handoff;
  if (!isRecord(handoff)) {
    issues.push(
      `handoff output ${assignment.workerId} is missing handoff object`,
    );
    return;
  }

  if (!readString(handoff.notes)) {
    issues.push(
      `handoff output ${assignment.workerId} is missing handoff.notes`,
    );
  }
}

function classifyRoleContract(
  assignment: SelectedSubagentAssignment,
): 'planner' | 'executor' | 'verifier' | 'reviewer' | 'handoff' | 'generic' {
  switch (assignment.primarySkill) {
    case 'plan':
      return 'planner';
    case 'team':
      return 'executor';
    case 'verify':
      return 'verifier';
    case 'review':
      return 'reviewer';
    case 'handoff':
      return 'handoff';
    default:
      break;
  }

  const source = `${assignment.id} ${assignment.role}`.toLowerCase();

  if (source.includes('planner')) {
    return 'planner';
  }

  if (source.includes('executor') || source.includes('implement')) {
    return 'executor';
  }

  if (
    source.includes('verifier') ||
    source.includes('qa') ||
    source.includes('test')
  ) {
    return 'verifier';
  }

  if (source.includes('review') || source.includes('critic')) {
    return 'reviewer';
  }

  if (
    source.includes('handoff') ||
    source.includes('writer') ||
    source.includes('document')
  ) {
    return 'handoff';
  }

  return 'generic';
}

function parseRoleOutputs(runtime: Record<string, unknown>): Record<string, unknown>[] {
  const outputs = runtime.roleOutputs;
  if (!Array.isArray(outputs)) {
    return [];
  }

  return outputs.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}

export function evaluateRoleOutputContract(
  snapshot: TeamSnapshot,
  options: RoleOutputContractOptions = {},
): RoleOutputContractReport {
  const runtime = snapshot.runtime;
  if (!isRecord(runtime)) {
    return {
      applicable: false,
      passed: true,
      summary: 'role output contract not applicable: runtime metadata unavailable',
      issues: [],
      metadata: {
        applicable: false,
        assignmentCount: 0,
        outputCount: 0,
      },
    };
  }

  const assignments = parseAssignments(runtime);
  if (assignments.length === 0) {
    return {
      applicable: false,
      passed: true,
      summary: 'role output contract not applicable: selected subagent assignments absent',
      issues: [],
      metadata: {
        applicable: false,
        assignmentCount: 0,
        outputCount: 0,
      },
    };
  }

  const outputs = parseRoleOutputs(runtime);
  const usedOutputIndexes = new Set<number>();
  const issues: string[] = [];
  const evidenceState: ArtifactEvidenceState = {
    enabled: options.requireArtifactEvidence === true,
    rootPath: undefined,
    checkedCount: 0,
    passedCount: 0,
    failedCount: 0,
  };

  if (evidenceState.enabled) {
    const cwd =
      readString(options.cwd) ??
      readArtifactEvidenceCwd(runtime);
    if (!cwd) {
      issues.push(
        'artifact evidence validation requested but cwd is unavailable',
      );
    } else {
      evidenceState.rootPath = resolveArtifactRootPath({
        cwd,
        teamName: options.teamName ?? snapshot.teamName,
      });
    }
  }

  for (const assignment of assignments) {
    const matched = findOutputForAssignment(outputs, assignment, usedOutputIndexes);
    if (!matched) {
      issues.push(
        `missing role output for ${assignment.id} (${assignment.workerId})`,
      );
      continue;
    }

    usedOutputIndexes.add(matched.index);
    const baseValidation = validateBaseRoleOutput(
      matched.output,
      assignment,
      issues,
    );
    if (baseValidation.status !== 'completed') {
      issues.push(
        `role output ${assignment.id} (${assignment.workerId}) is not completed`,
      );
    }

    if (evidenceState.enabled && evidenceState.rootPath) {
      validateArtifactEvidenceRefs({
        assignment,
        artifactRefs: baseValidation.artifactRefs,
        rootPath: evidenceState.rootPath,
        runtimeCwd:
          readString(options.cwd) ??
          readArtifactEvidenceCwd(runtime) ??
          '',
        issues,
        evidenceState,
      });
    }

    const contractType = classifyRoleContract(assignment);
    switch (contractType) {
      case 'planner':
        validatePlannerOutput(matched.output, assignment, issues);
        break;
      case 'executor':
        validateExecutorOutput(matched.output, assignment, issues);
        break;
      case 'verifier':
        validateVerifierOutput(matched.output, assignment, issues);
        break;
      case 'reviewer':
        validateReviewerOutput(matched.output, assignment, issues);
        break;
      case 'handoff':
        validateHandoffOutput(matched.output, assignment, issues);
        break;
      default:
        break;
    }
  }

  const extraOutputs = outputs.length - usedOutputIndexes.size;
  const passed = issues.length === 0;
  const summary = passed
    ? `role output contract passed for ${assignments.length} assignment(s)`
    : `role output contract failed: ${issues.join(' | ')}`;

  return {
    applicable: true,
    passed,
    summary,
    issues,
    metadata: {
      applicable: true,
      assignmentCount: assignments.length,
      outputCount: outputs.length,
      matchedOutputCount: usedOutputIndexes.size,
      extraOutputCount: extraOutputs < 0 ? 0 : extraOutputs,
      artifactEvidenceEnabled: evidenceState.enabled,
      artifactEvidenceRoot: evidenceState.rootPath,
      artifactEvidenceCheckedCount: evidenceState.checkedCount,
      artifactEvidencePassedCount: evidenceState.passedCount,
      artifactEvidenceFailedCount: evidenceState.failedCount,
    },
  };
}

function sanitizeArtifactSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveArtifactRootPath(params: {
  cwd: string;
  teamName: string;
}): string {
  const team = sanitizeArtifactSegment(params.teamName) || 'team';
  return path.resolve(
    params.cwd,
    '.omg',
    'state',
    'team',
    team,
    'artifacts',
    'roles',
  );
}

function readArtifactEvidenceCwd(runtime: Record<string, unknown>): string | undefined {
  const runInput = runtime.runInput;
  if (isRecord(runInput)) {
    const runInputCwd = readString(runInput.cwd);
    if (runInputCwd) {
      return runInputCwd;
    }
  }

  return readString(runtime.cwd);
}

function resolveArtifactRefToPath(
  runtimeCwd: string,
  artifactRef: string,
): string | undefined {
  const ref = artifactRef.trim();
  if (!ref) {
    return undefined;
  }

  if (ref.startsWith('file://')) {
    try {
      return path.resolve(fileURLToPath(ref));
    } catch {
      return undefined;
    }
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) {
    return undefined;
  }

  if (path.isAbsolute(ref)) {
    return path.resolve(ref);
  }

  return path.resolve(runtimeCwd, ref);
}

function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function validateArtifactEvidenceRefs(params: {
  assignment: SelectedSubagentAssignment;
  artifactRefs: string[];
  rootPath: string;
  runtimeCwd: string;
  issues: string[];
  evidenceState: ArtifactEvidenceState;
}): void {
  const {
    assignment,
    artifactRefs,
    rootPath,
    runtimeCwd,
    issues,
    evidenceState,
  } = params;

  for (const artifactRef of artifactRefs) {
    const resolvedPath = resolveArtifactRefToPath(runtimeCwd, artifactRef);
    evidenceState.checkedCount += 1;

    if (!resolvedPath) {
      evidenceState.failedCount += 1;
      issues.push(
        `role output ${assignment.id} (${assignment.workerId}) has non-file artifact reference: ${artifactRef}`,
      );
      continue;
    }

    if (!isPathWithinRoot(resolvedPath, rootPath)) {
      evidenceState.failedCount += 1;
      issues.push(
        `role output ${assignment.id} (${assignment.workerId}) artifact is outside deterministic root: ${artifactRef}`,
      );
      continue;
    }

    try {
      const stats = statSync(resolvedPath);
      if (!stats.isFile() || stats.size <= 0) {
        evidenceState.failedCount += 1;
        issues.push(
          `role output ${assignment.id} (${assignment.workerId}) artifact is empty or invalid: ${artifactRef}`,
        );
        continue;
      }
    } catch {
      evidenceState.failedCount += 1;
      issues.push(
        `role output ${assignment.id} (${assignment.workerId}) artifact file is missing: ${artifactRef}`,
      );
      continue;
    }

    evidenceState.passedCount += 1;
  }
}
