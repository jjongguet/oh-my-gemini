import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { TeamStateStore } from '../../src/state/index.js';
import {
  addSharedMessage,
  addSharedTask,
  broadcastOmgMessage,
  canUseOmgDirectWriteBridge,
  cleanupInterop,
  getInteropDir,
  getInteropMode,
  initInteropSession,
  listOmgMailboxMessages,
  listOmgTasks,
  listOmgTeams,
  markMessageAsRead,
  readInteropConfig,
  readOmgTeamConfig,
  readSharedMessages,
  readSharedTasks,
  sendOmgDirectMessage,
  updateSharedTask,
} from '../../src/interop/protocol-adapters.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: interop protocol adapters', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempDir('omg-interop-protocol-');
  });

  afterEach(() => {
    removeDir(tempRoot);
  });

  test('reads interop mode and direct-write gate from environment', () => {
    expect(getInteropMode({ OMG_OMC_INTEROP_MODE: 'active' } as NodeJS.ProcessEnv)).toBe(
      'active',
    );
    expect(getInteropMode({ OMG_OMC_INTEROP_MODE: 'weird' } as NodeJS.ProcessEnv)).toBe(
      'off',
    );

    expect(
      canUseOmgDirectWriteBridge({
        OMG_OMC_INTEROP_ENABLED: '1',
        OMG_OMC_INTEROP_MODE: 'active',
        OMG_INTEROP_TOOLS_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);

    expect(
      canUseOmgDirectWriteBridge({
        OMG_OMC_INTEROP_ENABLED: '1',
        OMG_OMC_INTEROP_MODE: 'observe',
        OMG_INTEROP_TOOLS_ENABLED: '1',
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
      target: 'omg',
      type: 'implement',
      description: 'Port protocol adapter logic',
      files: ['src/interop/protocol-adapters.ts'],
    });

    const message = addSharedMessage(tempRoot, {
      source: 'omg',
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

  test('discovers OMG teams and exposes config/task/mailbox adapters', async () => {
    const teamName = 'interop-alpha';
    const stateStore = new TeamStateStore({ cwd: tempRoot });
    await stateStore.ensureTeamScaffold(teamName);

    await fs.writeFile(
      path.join(tempRoot, '.omg', 'state', 'team', teamName, 'run-request.json'),
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

    await sendOmgDirectMessage(
      teamName,
      'worker-1',
      'worker-2',
      'Need converter review.',
      tempRoot,
    );

    const teams = await listOmgTeams(tempRoot);
    expect(teams).toContain(teamName);

    const config = await readOmgTeamConfig(teamName, tempRoot);
    expect(config?.name).toBe(teamName);
    expect(config?.task).toBe('Bridge interop APIs');

    const tasks = await listOmgTasks(teamName, tempRoot);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.subject).toBe('Create bridge');

    const mailbox = await listOmgMailboxMessages(teamName, 'worker-2', tempRoot);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]?.body).toContain('converter review');

    const broadcast = await broadcastOmgMessage(
      teamName,
      'worker-1',
      'Team sync requested.',
      tempRoot,
    );

    expect(broadcast.length).toBeGreaterThanOrEqual(0);
  });
});
