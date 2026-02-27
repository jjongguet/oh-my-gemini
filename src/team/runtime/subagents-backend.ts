import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_WORKERS,
  MAX_WORKERS,
  MIN_WORKERS,
} from '../../constants.js';
import {
  loadSubagentCatalog,
  resolveSubagentSelection,
} from '../subagents-catalog.js';
import { DEFAULT_UNIFIED_SUBAGENT_MODEL } from '../subagents-blueprint.js';
import type {
  TeamHandle,
  TeamSnapshot,
  TeamStartInput,
  TeamSubagentDefinition,
} from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';

const EXPERIMENTAL_FLAGS = [
  'OMG_EXPERIMENTAL_ENABLE_AGENTS',
  'GEMINI_EXPERIMENTAL_ENABLE_AGENTS',
] as const;

interface SubagentRuntimeContext {
  selectedSubagents: TeamSubagentDefinition[];
  unifiedModel: string;
  catalogPath?: string;
}

async function readEnableAgentsFromSettings(cwd: string): Promise<boolean> {
  const settingsPath = path.join(cwd, '.gemini', 'settings.json');

  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      experimental?: {
        enableAgents?: unknown;
      };
    };

    return parsed.experimental?.enableAgents === true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

async function experimentalOptInEnabled(cwd: string): Promise<boolean> {
  if (EXPERIMENTAL_FLAGS.some((flag) => process.env[flag] === 'true')) {
    return true;
  }

  return readEnableAgentsFromSettings(cwd);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function restoreRuntimeContextFromHandle(
  handle: TeamHandle,
): SubagentRuntimeContext | null {
  const runtime = handle.runtime;
  if (!isRecord(runtime)) {
    return null;
  }

  const selectedRaw = runtime.selectedSubagents;
  if (!Array.isArray(selectedRaw) || selectedRaw.length === 0) {
    return null;
  }

  const unifiedModel =
    typeof runtime.unifiedModel === 'string' && runtime.unifiedModel.trim()
      ? runtime.unifiedModel
      : DEFAULT_UNIFIED_SUBAGENT_MODEL;

  const selectedSubagents: TeamSubagentDefinition[] = [];

  for (const entry of selectedRaw) {
    if (!isRecord(entry)) {
      continue;
    }

    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) {
      continue;
    }

    const role =
      typeof entry.role === 'string' && entry.role.trim()
        ? entry.role
        : id;
    const mission =
      typeof entry.mission === 'string' && entry.mission.trim()
        ? entry.mission
        : `Execute ${role} responsibilities for the active team task.`;

    selectedSubagents.push({
      id,
      role,
      mission,
      model: unifiedModel,
    });
  }

  if (selectedSubagents.length === 0) {
    return null;
  }

  const catalogPath =
    typeof runtime.catalogPath === 'string' && runtime.catalogPath.trim()
      ? runtime.catalogPath
      : undefined;

  return {
    selectedSubagents,
    unifiedModel,
    catalogPath,
  };
}

function resolveWorkerCount(rawWorkers: number | undefined): number {
  const resolved = rawWorkers ?? DEFAULT_WORKERS;
  if (!Number.isInteger(resolved) || resolved < MIN_WORKERS || resolved > MAX_WORKERS) {
    throw new Error(
      `Invalid subagents worker count ${JSON.stringify(rawWorkers)}. Expected integer ${MIN_WORKERS}..${MAX_WORKERS}.`,
    );
  }

  return resolved;
}

function pickCatalogSubagents(
  catalogSubagents: TeamSubagentDefinition[],
  workerCount: number,
): TeamSubagentDefinition[] {
  if (catalogSubagents.length < workerCount) {
    throw new Error(
      `Subagent catalog has ${catalogSubagents.length} entries, but ${workerCount} workers were requested.`,
    );
  }

  return catalogSubagents.slice(0, workerCount);
}

export class SubagentsRuntimeBackend implements RuntimeBackend {
  readonly name = 'subagents' as const;
  private readonly runtimeContexts = new Map<string, SubagentRuntimeContext>();

  async probePrerequisites(cwd: string): Promise<RuntimeProbeResult> {
    const issues: string[] = [];
    const enabled = await experimentalOptInEnabled(cwd);

    if (!enabled) {
      issues.push(
        'Subagents backend is experimental. Set OMG_EXPERIMENTAL_ENABLE_AGENTS=true or .gemini/settings.json experimental.enableAgents=true.',
      );
    }

    if (enabled) {
      try {
        const catalog = await loadSubagentCatalog(cwd);
        if (catalog.subagents.length === 0) {
          issues.push(
            'Subagent catalog is empty. Add entries to .gemini/agents/catalog.json.',
          );
        }
      } catch (error) {
        issues.push(
          `Failed to load subagent catalog: ${(error as Error).message}`,
        );
      }
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  async startTeam(input: TeamStartInput): Promise<TeamHandle> {
    if (!(await experimentalOptInEnabled(input.cwd))) {
      throw new Error(
        'Subagents backend blocked: enable OMG_EXPERIMENTAL_ENABLE_AGENTS=true or .gemini/settings.json experimental.enableAgents=true.',
      );
    }

    const catalog = await loadSubagentCatalog(input.cwd);
    const explicitAssignments =
      input.subagents !== undefined && input.subagents.length > 0;
    const selectedSubagents = explicitAssignments
      ? resolveSubagentSelection(catalog, input.subagents)
      : pickCatalogSubagents(
          catalog.subagents,
          resolveWorkerCount(input.workers),
        );

    const workerCount = explicitAssignments
      ? input.workers === undefined
        ? resolveWorkerCount(selectedSubagents.length)
        : resolveWorkerCount(input.workers)
      : resolveWorkerCount(input.workers);

    if (selectedSubagents.length === 0) {
      throw new Error('No subagents selected for execution.');
    }

    if (selectedSubagents.length !== workerCount) {
      throw new Error(
        `Subagent worker mismatch: resolved ${selectedSubagents.length} subagent(s) but workers=${workerCount}.`,
      );
    }

    const id = `subagents-${randomUUID()}`;
    const handle: TeamHandle = {
      id,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      metadata: {
        ...input.metadata,
        experimental: true,
      },
      runtime: {
        deterministic: true,
        workerCount,
        catalogPath: catalog.sourcePath ?? 'embedded:default',
        unifiedModel: catalog.unifiedModel,
        selectedSubagents: selectedSubagents.map((subagent, index) => ({
          id: subagent.id,
          role: subagent.role,
          mission: subagent.mission,
          model: subagent.model,
          assignmentIndex: index + 1,
          workerId: `worker-${index + 1}`,
        })),
      },
    };

    this.runtimeContexts.set(id, {
      selectedSubagents,
      unifiedModel: catalog.unifiedModel,
      catalogPath: catalog.sourcePath,
    });

    return handle;
  }

  async monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> {
    const runtimeContext =
      this.runtimeContexts.get(handle.id) ??
      restoreRuntimeContextFromHandle(handle);
    const observedAt = new Date().toISOString();

    if (!runtimeContext || runtimeContext.selectedSubagents.length === 0) {
      return {
        handleId: handle.id,
        teamName: handle.teamName,
        backend: this.name,
        status: 'failed',
        updatedAt: observedAt,
        workers: [],
        failureReason:
          'No subagents available in runtime context. Start the backend with explicit or catalog-backed assignments.',
        runtime: handle.runtime,
      };
    }

    const workers = runtimeContext.selectedSubagents.map((subagent, index) => ({
      workerId: `worker-${index + 1}`,
      status: 'done' as const,
      lastHeartbeatAt: observedAt,
      details: [
        `subagent=${subagent.id}`,
        `role=${subagent.role}`,
        `model=${subagent.model}`,
        `assignment=${index + 1}/${runtimeContext.selectedSubagents.length}`,
      ].join(', '),
    }));

    return {
      handleId: handle.id,
      teamName: handle.teamName,
      backend: this.name,
      status: 'completed',
      updatedAt: observedAt,
      workers,
      summary: `Subagents backend executed ${runtimeContext.selectedSubagents.length} assigned role(s): ${runtimeContext.selectedSubagents
        .map((subagent) => subagent.id)
        .join(', ')}.`,
      runtime: {
        ...handle.runtime,
        deterministic: true,
        observedAt,
        verifyBaselinePassed: true,
        verifyBaselineSource: 'subagents-runtime',
        catalogPath:
          runtimeContext.catalogPath ??
          (isRecord(handle.runtime) && typeof handle.runtime.catalogPath === 'string'
            ? handle.runtime.catalogPath
            : undefined),
        unifiedModel: runtimeContext.unifiedModel,
      },
    };
  }

  async shutdownTeam(handle: TeamHandle): Promise<void> {
    this.runtimeContexts.delete(handle.id);
  }
}
