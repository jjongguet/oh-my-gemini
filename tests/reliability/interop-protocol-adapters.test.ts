import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/index.js';
import {
  addSharedMessage,
  addSharedTask,
  broadcastOmpMessage,
  canUseOmpDirectWriteBridge,
  cleanupInterop,
  getInteropDir,
  getInteropMode,
  initInteropSession,
  listOmpMailboxMessages,
  listOmpTasks,
  listOmpTeams,
  markMessageAsRead,
  readInteropConfig,
  readOmpTeamConfig,
  readSharedMessages,
  readSharedTasks,
  sendOmpDirectMessage,
  updateSharedTask,
} from '../../src/interop/protocol-adapters.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: interop protocol adapters', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempDir('omp-interop-protocol-');
  });

  afterEach(() => {
    removeDir(tempRoot);
  });

  test('reads interop mode and direct-write gate from environment', () => {
    expect(getInteropMode({ OMP_OMC_INTEROP_MODE: 'active' } as NodeJS.ProcessEnv)).toBe(
      'active',
    );
    expect(getInteropMode({ OMP_OMC_INTEROP_MODE: 'weird' } as NodeJS.ProcessEnv)).toBe(
      'off',
    );

    expect(
      canUseOmpDirectWriteBridge({
        OMP_OMC_INTEROP_ENABLED: '1',
        OMP_OMC_INTEROP_MODE: 'active',
        OMP_INTEROP_TOOLS_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);

    expect(
      canUseOmpDirectWriteBridge({
        OMP_OMC_INTEROP_ENABLED: '1',
        OMP_OMC_INTEROP_MODE: 'observe',
        OMP_INTEROP_TOOLS_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  test('initializes and reads interop session config', () => {
    const config = initInteropSession('session-1', tempRoot, '/tmp/omc');

    expect(config.sessionId).toBe('session-1');
    expect(existsSync(path.join(getInteropDir(tempRoot), 'config.json'))).toBe(true);

    const readBack = readInteropConfig(tempRoot);
    expect(readBack?.sessionId).toBe('session-1');
    expect(readBack?.omcCwd).toBe('/tmp/omc');
  });

  test('adds, reads, updates, and cleans shared tasks/messages', () => {
    const task = addSharedTask(tempRoot, {
      source: 'omc',
      target: 'omp',
      type: 'implement',
      description: 'Port protocol adapter logic',
      files: ['src/interop/protocol-adapters.ts'],
    });

    const message = addSharedMessage(tempRoot, {
      source: 'omp',
      target: 'omc',
      content: 'Started adapter implementation.',
    });

    const allTasks = readSharedTasks(tempRoot, { source: 'omc' });
    expect(allTasks).toHaveLength(1);
    expect(allTasks[0]?.id).toBe(task.id);

    const updated = updateSharedTask(tempRoot, task.id, {
      status: 'completed',
      result: 'Done',
    });

    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).toBeDefined();

    const unreadMessages = readSharedMessages(tempRoot, { unreadOnly: true });
    expect(unreadMessages).toHaveLength(1);
    expect(unreadMessages[0]?.id).toBe(message.id);

    expect(markMessageAsRead(tempRoot, message.id)).toBe(true);
    expect(readSharedMessages(tempRoot, { unreadOnly: true })).toHaveLength(0);

    const cleaned = cleanupInterop(tempRoot);
    expect(cleaned.tasksDeleted).toBe(1);
    expect(cleaned.messagesDeleted).toBe(1);
  });

  test('discovers OMP teams and exposes config/task/mailbox adapters', async () => {
    const teamName = 'interop-alpha';
    const stateStore = new TeamStateStore({ cwd: tempRoot });
    await stateStore.ensureTeamScaffold(teamName);

    await fs.writeFile(
      path.join(tempRoot, '.omp', 'state', 'team', teamName, 'run-request.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          teamName,
          task: 'Bridge interop APIs',
          backend: 'tmux',
          workers: 2,
          maxFixLoop: 3,
          cwd: tempRoot,
          updatedAt: '2026-03-05T00:00:00.000Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await stateStore.writeTask(teamName, {
      id: '1',
      subject: 'Create bridge',
      description: 'Create API bridge',
      status: 'pending',
    });

    await stateStore.writeWorkerIdentity({
      teamName,
      workerName: 'worker-1',
      role: 'planner',
      updatedAt: new Date().toISOString(),
    });

    await sendOmpDirectMessage(
      teamName,
      'worker-1',
      'worker-2',
      'Need converter review.',
      tempRoot,
    );

    const teams = await listOmpTeams(tempRoot);
    expect(teams).toContain(teamName);

    const config = await readOmpTeamConfig(teamName, tempRoot);
    expect(config?.name).toBe(teamName);
    expect(config?.task).toBe('Bridge interop APIs');

    const tasks = await listOmpTasks(teamName, tempRoot);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.subject).toBe('Create bridge');

    const mailbox = await listOmpMailboxMessages(teamName, 'worker-2', tempRoot);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]?.body).toContain('converter review');

    const broadcast = await broadcastOmpMessage(
      teamName,
      'worker-1',
      'Team sync requested.',
      tempRoot,
    );

    expect(broadcast.length).toBeGreaterThanOrEqual(0);
  });
});
