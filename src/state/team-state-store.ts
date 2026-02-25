import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  appendNdjsonFile,
  ensureDirectory,
  readJsonFile,
  writeJsonFile,
} from './filesystem.js';
import type {
  PersistedPhaseTransitionEvent,
  PersistedTeamPhaseState,
  PersistedTeamSnapshot,
  PersistedWorkerHeartbeat,
  PersistedWorkerStatus,
} from './types.js';

export interface TeamStateStoreOptions {
  rootDir?: string;
  cwd?: string;
}

export class TeamStateStore {
  readonly rootDir: string;

  constructor(options: TeamStateStoreOptions = {}) {
    const cwd = options.cwd ?? process.cwd();
    const configuredRoot =
      options.rootDir ?? process.env.OMG_STATE_ROOT ?? '.omg/state';

    this.rootDir = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(cwd, configuredRoot);
  }

  getTeamDir(teamName: string): string {
    return path.join(this.rootDir, 'team', teamName);
  }

  getPhaseFilePath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'phase.json');
  }

  getPhaseEventLogPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'events', 'phase-transitions.ndjson');
  }

  getMonitorSnapshotPath(teamName: string): string {
    return path.join(this.getTeamDir(teamName), 'monitor-snapshot.json');
  }

  getWorkerDir(teamName: string, workerName: string): string {
    return path.join(this.getTeamDir(teamName), 'workers', workerName);
  }

  getWorkerHeartbeatPath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'heartbeat.json');
  }

  getWorkerStatusPath(teamName: string, workerName: string): string {
    return path.join(this.getWorkerDir(teamName, workerName), 'status.json');
  }

  async ensureTeamScaffold(teamName: string): Promise<void> {
    const teamDir = this.getTeamDir(teamName);
    await Promise.all([
      ensureDirectory(teamDir),
      ensureDirectory(path.join(teamDir, 'events')),
      ensureDirectory(path.join(teamDir, 'workers')),
    ]);
  }

  async readPhaseState(teamName: string): Promise<PersistedTeamPhaseState | null> {
    return readJsonFile<PersistedTeamPhaseState>(this.getPhaseFilePath(teamName));
  }

  async writePhaseState(
    teamName: string,
    state: PersistedTeamPhaseState,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await writeJsonFile(this.getPhaseFilePath(teamName), state);
  }

  async appendPhaseTransition(
    teamName: string,
    transition: PersistedPhaseTransitionEvent,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await appendNdjsonFile(this.getPhaseEventLogPath(teamName), transition);
  }

  async readMonitorSnapshot(
    teamName: string,
  ): Promise<PersistedTeamSnapshot | null> {
    return readJsonFile<PersistedTeamSnapshot>(this.getMonitorSnapshotPath(teamName));
  }

  async writeMonitorSnapshot(
    teamName: string,
    snapshot: PersistedTeamSnapshot,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await writeJsonFile(this.getMonitorSnapshotPath(teamName), snapshot);
  }

  async readWorkerHeartbeat(
    teamName: string,
    workerName: string,
  ): Promise<PersistedWorkerHeartbeat | null> {
    return readJsonFile<PersistedWorkerHeartbeat>(
      this.getWorkerHeartbeatPath(teamName, workerName),
    );
  }

  async writeWorkerHeartbeat(
    heartbeat: PersistedWorkerHeartbeat,
  ): Promise<void> {
    await this.ensureTeamScaffold(heartbeat.teamName);
    await writeJsonFile(
      this.getWorkerHeartbeatPath(heartbeat.teamName, heartbeat.workerName),
      heartbeat,
    );
  }

  async readWorkerStatus(
    teamName: string,
    workerName: string,
  ): Promise<PersistedWorkerStatus | null> {
    return readJsonFile<PersistedWorkerStatus>(
      this.getWorkerStatusPath(teamName, workerName),
    );
  }

  async writeWorkerStatus(
    teamName: string,
    workerName: string,
    status: PersistedWorkerStatus,
  ): Promise<void> {
    await this.ensureTeamScaffold(teamName);
    await writeJsonFile(this.getWorkerStatusPath(teamName, workerName), status);
  }

  async listWorkers(teamName: string): Promise<string[]> {
    const workersDir = path.join(this.getTeamDir(teamName), 'workers');

    try {
      const entries = await fs.readdir(workersDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }

      throw new Error(
        `Failed to list workers for team "${teamName}": ${(error as Error).message}`,
      );
    }
  }

  async readAllWorkerHeartbeats(
    teamName: string,
  ): Promise<Record<string, PersistedWorkerHeartbeat>> {
    const workers = await this.listWorkers(teamName);
    const heartbeats = await Promise.all(
      workers.map(async (workerName) => {
        const heartbeat = await this.readWorkerHeartbeat(teamName, workerName);
        return heartbeat ? [workerName, heartbeat] : null;
      }),
    );

    return Object.fromEntries(
      heartbeats.filter(
        (entry): entry is [string, PersistedWorkerHeartbeat] => entry !== null,
      ),
    );
  }

  async readAllWorkerStatuses(
    teamName: string,
  ): Promise<Record<string, PersistedWorkerStatus>> {
    const workers = await this.listWorkers(teamName);
    const statuses = await Promise.all(
      workers.map(async (workerName) => {
        const status = await this.readWorkerStatus(teamName, workerName);
        return status ? [workerName, status] : null;
      }),
    );

    return Object.fromEntries(
      statuses.filter(
        (entry): entry is [string, PersistedWorkerStatus] => entry !== null,
      ),
    );
  }
}
