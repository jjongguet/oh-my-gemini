import { describe, expect, test } from 'vitest';

import { evaluateTeamHealth } from '../../src/team/monitor.js';

describe('reliability: dead worker watchdog', () => {
  test('evaluateTeamHealth flags dead and non-reporting workers', () => {
    const now = new Date('2026-02-25T00:00:00.000Z');
    const report = evaluateTeamHealth(
      {
        handleId: 'h-1',
        teamName: 't-1',
        backend: 'tmux',
        status: 'running',
        updatedAt: '2026-02-24T23:59:00.000Z',
        workers: [
          {
            workerId: 'worker-1',
            status: 'failed',
            lastHeartbeatAt: '2026-02-24T23:58:00.000Z',
          },
          {
            workerId: 'worker-2',
            status: 'running',
            lastHeartbeatAt: '2026-02-24T23:54:00.000Z',
          },
        ],
      },
      {
        now,
        watchdogMs: 120_000,
        nonReportingMs: 180_000,
      },
    );

    expect(report.healthy).toBe(false);
    expect(report.deadWorkers).toContain('worker-1');
    expect(report.nonReportingWorkers).toContain('worker-2');
    expect(report.watchdogExpired).toBe(false);
    expect(report.summary).toMatch(/dead|non-reporting/i);
  });

  test('workers requiring heartbeat are non-reporting when heartbeat is missing', () => {
    const now = new Date('2026-02-25T00:00:00.000Z');
    const report = evaluateTeamHealth(
      {
        handleId: 'h-2',
        teamName: 't-2',
        backend: 'tmux',
        status: 'running',
        updatedAt: '2026-02-25T00:00:00.000Z',
        workers: [
          {
            workerId: 'worker-without-heartbeat',
            status: 'running',
          },
          {
            workerId: 'worker-idle-no-heartbeat',
            status: 'idle',
          },
        ],
      },
      {
        now,
        watchdogMs: 120_000,
        nonReportingMs: 180_000,
      },
    );

    expect(report.healthy).toBe(false);
    expect(report.nonReportingWorkers).toContain('worker-without-heartbeat');
    expect(report.nonReportingWorkers).not.toContain('worker-idle-no-heartbeat');
  });

  test('invalid snapshot timestamp trips watchdog deterministically', () => {
    const report = evaluateTeamHealth({
      handleId: 'h-3',
      teamName: 't-3',
      backend: 'tmux',
      status: 'running',
      updatedAt: 'not-a-real-date',
      workers: [
        {
          workerId: 'worker-1',
          status: 'running',
          lastHeartbeatAt: new Date().toISOString(),
        },
      ],
    });

    expect(report.healthy).toBe(false);
    expect(report.watchdogExpired).toBe(true);
    expect(report.summary).toMatch(/watchdog timestamp invalid/i);
  });
});
