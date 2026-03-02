import { beforeEach, describe, expect, test, vi } from 'vitest';

const { runCommandMock } = vi.hoisted(() => ({
  runCommandMock: vi.fn(),
}));

vi.mock('../../src/team/runtime/process-utils.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/team/runtime/process-utils.js')
  >('../../src/team/runtime/process-utils.js');

  return {
    ...actual,
    runCommand: runCommandMock,
  };
});

import { TmuxRuntimeBackend } from '../../src/team/runtime/tmux-backend.js';

describe('reliability: tmux runtime backend', () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  test('startTeam configures manual window sizing before pane splits', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // new-session
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // remain-on-exit
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // window-size manual
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // resize-window
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // send-keys
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // split worker-2
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // select-layout

    const backend = new TmuxRuntimeBackend();

    const handle = await backend.startTeam({
      teamName: 'tmux-sizing',
      task: 'smoke',
      cwd: process.cwd(),
      workers: 2,
      backend: 'tmux',
    });

    expect(handle.runtime.taskAuditLogPath).toMatch(/events\/task-lifecycle\.ndjson$/);

    const calls = runCommandMock.mock.calls.map((call) => ({
      command: call[0] as string,
      args: call[1] as string[],
    }));

    expect(
      calls.some(
        (call) =>
          call.command === 'tmux' &&
          call.args.includes('set-window-option') &&
          call.args.includes('window-size') &&
          call.args.includes('manual'),
      ),
    ).toBe(true);

    expect(
      calls.some(
        (call) =>
          call.command === 'tmux' &&
          call.args.includes('resize-window') &&
          call.args.includes('-x') &&
          call.args.includes('240'),
      ),
    ).toBe(true);
  });

  test('startTeam returns actionable error when tmux pane space is exhausted', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // new-session
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // remain-on-exit
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // window-size manual
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // resize-window
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // send-keys
      .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'no space for new pane' }) // split failure
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // cleanup kill-session

    const backend = new TmuxRuntimeBackend();

    await expect(
      backend.startTeam({
        teamName: 'tmux-no-space',
        task: 'smoke',
        cwd: process.cwd(),
        workers: 8,
        backend: 'tmux',
      }),
    ).rejects.toThrow(/try increasing tmux window size|fewer workers/i);
  });

  test('monitorTeam publishes status counts for runtime observability', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // has-session
      .mockResolvedValueOnce({
        code: 0,
        stdout: [
          '0\t%1\t0\t0\tnode\tactive\t2026-03-01T00:00:00.000Z',
          '1\t%2\t1\t0\tnode\tinactive\t2026-03-01T00:00:00.000Z',
        ].join('\n'),
        stderr: '',
      }); // list-panes

    const backend = new TmuxRuntimeBackend();

    const snapshot = await backend.monitorTeam({
      id: 'tmux-handle',
      teamName: 'tmux-observe',
      backend: 'tmux',
      cwd: process.cwd(),
      startedAt: new Date().toISOString(),
      runtime: {
        sessionName: 'tmux-observe-1',
      },
    });

    const runtime = snapshot.runtime ?? {};
    const counts = runtime.workerStatusCounts as
      | { running: number; done: number; failed: number; unknown: number }
      | undefined;

    expect(runtime.sessionExists).toBe(true);
    expect(runtime.paneCount).toBe(2);
    expect(counts).toEqual({
      running: 1,
      done: 1,
      failed: 0,
      unknown: 0,
    });
  });

  test('startTeam exports OMG_TEAM_* worker env and keeps OMX_* compatibility aliases', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // new-session
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // remain-on-exit
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // window-size manual
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // resize-window
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // send-keys
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // select-layout

    const backend = new TmuxRuntimeBackend();

    const handle = await backend.startTeam({
      teamName: 'tmux-env',
      task: 'smoke',
      cwd: process.cwd(),
      workers: 1,
      backend: 'tmux',
      env: {
        OMG_TEAM_STATE_ROOT: '/tmp/omg-state',
        OMX_TEAM_STATE_ROOT: '/tmp/legacy-state',
      },
    });

    const sendKeysCall = runCommandMock.mock.calls.find(
      (call) =>
        call[0] === 'tmux' &&
        Array.isArray(call[1]) &&
        (call[1] as string[]).includes('send-keys'),
    );
    expect(sendKeysCall).toBeDefined();

    const sendKeysArgs = (sendKeysCall?.[1] ?? []) as string[];
    const workerCommand = sendKeysArgs[3] ?? '';

    expect(workerCommand).toContain("OMG_TEAM_WORKER='tmux-env/worker-1'");
    expect(workerCommand).toContain("OMX_TEAM_WORKER='tmux-env/worker-1'");
    expect(workerCommand).toContain("OMG_TEAM_STATE_ROOT='/tmp/omg-state'");
    expect(workerCommand).toContain("OMX_TEAM_STATE_ROOT='/tmp/omg-state'");
    expect(workerCommand).not.toContain('/tmp/legacy-state');
    expect(handle.runtime.taskAuditLogPath).toBe(
      '/tmp/omg-state/team/tmux-env/events/task-lifecycle.ndjson',
    );
  });

  test('startTeam falls back to OMG_STATE_ROOT when OMG_TEAM_STATE_ROOT/OMX_TEAM_STATE_ROOT are absent', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // new-session
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // remain-on-exit
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // window-size manual
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // resize-window
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // send-keys
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // select-layout

    const backend = new TmuxRuntimeBackend();

    const handle = await backend.startTeam({
      teamName: 'tmux-omg-state-root',
      task: 'smoke',
      cwd: process.cwd(),
      workers: 1,
      backend: 'tmux',
      env: {
        OMG_STATE_ROOT: '/tmp/omg-state-root-only',
      },
    });

    const sendKeysCall = runCommandMock.mock.calls.find(
      (call) =>
        call[0] === 'tmux' &&
        Array.isArray(call[1]) &&
        (call[1] as string[]).includes('send-keys'),
    );
    expect(sendKeysCall).toBeDefined();

    const sendKeysArgs = (sendKeysCall?.[1] ?? []) as string[];
    const workerCommand = sendKeysArgs[3] ?? '';

    expect(workerCommand).toContain("OMG_STATE_ROOT='/tmp/omg-state-root-only'");
    expect(workerCommand).toContain("OMG_TEAM_STATE_ROOT='/tmp/omg-state-root-only'");
    expect(workerCommand).toContain("OMX_TEAM_STATE_ROOT='/tmp/omg-state-root-only'");
    expect(handle.runtime.taskAuditLogPath).toBe(
      '/tmp/omg-state-root-only/team/tmux-omg-state-root/events/task-lifecycle.ndjson',
    );
  });

  test('startTeam falls back to process env OMG_STATE_ROOT when input env is omitted', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // new-session
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // remain-on-exit
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // window-size manual
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // resize-window
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // send-keys
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // select-layout

    const previousOmgTeamStateRoot = process.env.OMG_TEAM_STATE_ROOT;
    const previousOmxTeamStateRoot = process.env.OMX_TEAM_STATE_ROOT;
    const previousOmgStateRoot = process.env.OMG_STATE_ROOT;

    try {
      delete process.env.OMG_TEAM_STATE_ROOT;
      delete process.env.OMX_TEAM_STATE_ROOT;
      process.env.OMG_STATE_ROOT = '/tmp/process-omg-state-root';

      const backend = new TmuxRuntimeBackend();

      const handle = await backend.startTeam({
        teamName: 'tmux-process-env-state-root',
        task: 'smoke',
        cwd: process.cwd(),
        workers: 1,
        backend: 'tmux',
      });

      const sendKeysCall = runCommandMock.mock.calls.find(
        (call) =>
          call[0] === 'tmux' &&
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('send-keys'),
      );
      expect(sendKeysCall).toBeDefined();

      const sendKeysArgs = (sendKeysCall?.[1] ?? []) as string[];
      const workerCommand = sendKeysArgs[3] ?? '';

      expect(workerCommand).toContain("OMG_TEAM_STATE_ROOT='/tmp/process-omg-state-root'");
      expect(workerCommand).toContain("OMX_TEAM_STATE_ROOT='/tmp/process-omg-state-root'");
      expect(handle.runtime.taskAuditLogPath).toBe(
        '/tmp/process-omg-state-root/team/tmux-process-env-state-root/events/task-lifecycle.ndjson',
      );
    } finally {
      if (previousOmgTeamStateRoot === undefined) {
        delete process.env.OMG_TEAM_STATE_ROOT;
      } else {
        process.env.OMG_TEAM_STATE_ROOT = previousOmgTeamStateRoot;
      }

      if (previousOmxTeamStateRoot === undefined) {
        delete process.env.OMX_TEAM_STATE_ROOT;
      } else {
        process.env.OMX_TEAM_STATE_ROOT = previousOmxTeamStateRoot;
      }

      if (previousOmgStateRoot === undefined) {
        delete process.env.OMG_STATE_ROOT;
      } else {
        process.env.OMG_STATE_ROOT = previousOmgStateRoot;
      }
    }
  });

  test('startTeam canonicalizes mixed-case team names in worker env and taskAuditLogPath metadata', async () => {
    runCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // new-session
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // remain-on-exit
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // window-size manual
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // resize-window
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // send-keys
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // select-layout

    const backend = new TmuxRuntimeBackend();

    const handle = await backend.startTeam({
      teamName: 'My Team',
      task: 'smoke',
      cwd: process.cwd(),
      workers: 1,
      backend: 'tmux',
      env: {
        OMG_TEAM_STATE_ROOT: '/tmp/canonical-state-root',
      },
    });

    const sendKeysCall = runCommandMock.mock.calls.find(
      (call) =>
        call[0] === 'tmux' &&
        Array.isArray(call[1]) &&
        (call[1] as string[]).includes('send-keys'),
    );
    expect(sendKeysCall).toBeDefined();

    const sendKeysArgs = (sendKeysCall?.[1] ?? []) as string[];
    const workerCommand = sendKeysArgs[3] ?? '';

    expect(workerCommand).toContain("OMG_TEAM_WORKER='my-team/worker-1'");
    expect(workerCommand).toContain("OMX_TEAM_WORKER='my-team/worker-1'");
    expect(handle.runtime.taskAuditLogPath).toBe(
      '/tmp/canonical-state-root/team/my-team/events/task-lifecycle.ndjson',
    );
  });
});
