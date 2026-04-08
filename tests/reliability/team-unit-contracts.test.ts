import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { evaluateTeamHealth } from '../../src/team/monitor.js';
import {
  createDefaultSubagentCatalog,
  DEFAULT_UNIFIED_SUBAGENT_MODEL,
} from '../../src/team/subagents-blueprint.js';
import {
  loadSubagentCatalog,
  normalizeSubagentId,
  resolveSubagentSelection,
} from '../../src/team/subagents-catalog.js';
import { buildDoneSignal } from '../../src/team/worker-signals.js';
import type { TeamSnapshot } from '../../src/team/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function createSnapshot(input: Partial<TeamSnapshot> = {}): TeamSnapshot {
  return {
    handleId: input.handleId ?? 'handle-1',
    teamName: input.teamName ?? 'team-unit',
    backend: input.backend ?? 'tmux',
    status: input.status ?? 'running',
    updatedAt: input.updatedAt ?? '2026-03-04T00:00:00.000Z',
    workers: input.workers ?? [],
    summary: input.summary,
    failureReason: input.failureReason,
    runtime: input.runtime,
    phase: input.phase,
  };
}

describe('reliability: team module unit contracts', () => {
  test('evaluateTeamHealth reports healthy status when watchdog and heartbeats are fresh', () => {
    const report = evaluateTeamHealth(
      createSnapshot({
        updatedAt: '2026-03-04T00:00:00.000Z',
        workers: [
          {
            workerId: 'worker-1',
            status: 'running',
            lastHeartbeatAt: '2026-03-03T23:59:30.000Z',
          },
          {
            workerId: 'worker-2',
            status: 'done',
          },
        ],
      }),
      {
        now: new Date('2026-03-04T00:00:10.000Z'),
        watchdogMs: 60_000,
        nonReportingMs: 120_000,
      },
    );

    expect(report.healthy).toBe(true);
    expect(report.deadWorkers).toStrictEqual([]);
    expect(report.nonReportingWorkers).toStrictEqual([]);
    expect(report.watchdogExpired).toBe(false);
    expect(report.summary).toMatch(/healthy: no dead\/non-reporting workers detected/i);
  });

  test('evaluateTeamHealth surfaces failed snapshot reason in summary', () => {
    const report = evaluateTeamHealth(
      createSnapshot({
        status: 'failed',
        failureReason: 'runtime backend marked worker-2 crashed',
      }),
      {
        now: new Date('2026-03-04T00:00:10.000Z'),
        watchdogMs: 60_000,
      },
    );

    expect(report.healthy).toBe(false);
    expect(report.summary).toMatch(/worker-2 crashed/i);
  });

  test('buildDoneSignal writes ISO completion timestamp and optional metadata', () => {
    const before = Date.now();
    const done = buildDoneSignal({
      teamName: 'team-unit',
      workerName: 'worker-3',
      status: 'failed',
      summary: 'verification failed',
      error: 'typecheck failed',
      taskId: 'task-9',
    });
    const after = Date.now();

    expect(done.status).toBe('failed');
    expect(done.summary).toBe('verification failed');
    expect(done.error).toBe('typecheck failed');
    expect(done.taskId).toBe('task-9');

    const completedAtMs = Date.parse(done.completedAt);
    expect(Number.isNaN(completedAtMs)).toBe(false);
    expect(completedAtMs).toBeGreaterThanOrEqual(before);
    expect(completedAtMs).toBeLessThanOrEqual(after);
  });

  test('createDefaultSubagentCatalog uses unified model for every subagent and includes inferred skills', () => {
    const catalog = createDefaultSubagentCatalog();

    expect(catalog.unifiedModel).toBe(DEFAULT_UNIFIED_SUBAGENT_MODEL);
    expect(catalog.subagents.length).toBeGreaterThan(10);
    expect(catalog.subagents.every((entry) => entry.model === catalog.unifiedModel)).toBe(
      true,
    );
    expect(catalog.subagents.every((entry) => (entry.skills ?? []).length > 0)).toBe(true);
  });

  test('normalizeSubagentId canonicalizes mixed punctuation tokens', () => {
    expect(normalizeSubagentId('  QA Tester++  ')).toBe('qa-tester');
    expect(normalizeSubagentId('__Plan__')).toBe('__plan__');
    expect(normalizeSubagentId('...')).toBe('...');
  });

  test('loadSubagentCatalog falls back to embedded defaults when disk catalog is missing', async () => {
    const tempRoot = createTempDir('omp-team-default-catalog-');

    try {
      const catalog = await loadSubagentCatalog(tempRoot);
      expect(catalog.sourcePath).toBeUndefined();
      expect(catalog.subagents.some((subagent) => subagent.id === 'planner')).toBe(true);

      const selected = resolveSubagentSelection(catalog, ['plan', 'execute']);
      expect(selected.map((entry) => entry.id)).toStrictEqual(['planner', 'executor']);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('loadSubagentCatalog throws actionable parse errors for malformed catalog JSON', async () => {
    const tempRoot = createTempDir('omp-team-catalog-parse-error-');

    try {
      const agentsDir = path.join(tempRoot, '.gemini', 'agents');
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, 'catalog.json'), '{invalid json', 'utf8');

      await expect(loadSubagentCatalog(tempRoot)).rejects.toThrow(
        /failed to parse subagent catalog json/i,
      );
    } finally {
      removeDir(tempRoot);
    }
  });
});
