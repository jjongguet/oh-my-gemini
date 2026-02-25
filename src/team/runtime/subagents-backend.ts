import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { TeamHandle, TeamSnapshot, TeamStartInput } from '../types.js';
import type { RuntimeBackend, RuntimeProbeResult } from './runtime-backend.js';

const EXPERIMENTAL_FLAGS = [
  'OMG_EXPERIMENTAL_ENABLE_AGENTS',
  'GEMINI_EXPERIMENTAL_ENABLE_AGENTS',
] as const;

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

export class SubagentsRuntimeBackend implements RuntimeBackend {
  readonly name = 'subagents' as const;

  async probePrerequisites(cwd: string): Promise<RuntimeProbeResult> {
    const issues: string[] = [];
    const enabled = await experimentalOptInEnabled(cwd);

    if (!enabled) {
      issues.push(
        'Subagents backend is experimental. Set OMG_EXPERIMENTAL_ENABLE_AGENTS=true or .gemini/settings.json experimental.enableAgents=true.',
      );
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

    return {
      id: `subagents-${randomUUID()}`,
      teamName: input.teamName,
      backend: this.name,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      metadata: {
        ...input.metadata,
        experimental: true,
      },
      runtime: {
        note: 'Scaffold backend only. Full Gemini subagents runtime will ship in Phase 3.',
      },
    };
  }

  async monitorTeam(handle: TeamHandle): Promise<TeamSnapshot> {
    return {
      handleId: handle.id,
      teamName: handle.teamName,
      backend: this.name,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      workers: [],
      failureReason:
        'Subagents backend is scaffold-only in MVP. Use tmux backend for runnable flows.',
      runtime: handle.runtime,
    };
  }

  async shutdownTeam(_handle: TeamHandle): Promise<void> {
    // No-op for scaffold backend.
  }
}
