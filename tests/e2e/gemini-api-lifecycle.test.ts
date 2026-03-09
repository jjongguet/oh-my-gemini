/**
 * E2E integration tests for Gemini API lifecycle.
 *
 * These tests exercise real Gemini API calls and the full worker lifecycle
 * including skill loading, hook firing, session recording, and artifact creation.
 *
 * Gated behind GEMINI_API_KEY — skipped when the env var is not set.
 */
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  GeminiApiClient,
  type GeminiGenerateContentResponse,
} from '../../src/providers/api-client.js';
import { TeamStateStore } from '../../src/state/team-state-store.js';
import { buildHeartbeatSignal, buildDoneSignal } from '../../src/team/worker-signals.js';
import { writeWorkerContext } from '../../src/hooks/context-writer.js';
import { readTeamContext } from '../../src/hooks/index.js';
import { dispatchSkill, listSkills } from '../../src/skills/dispatcher.js';
import { TaskControlPlane } from '../../src/team/control-plane/index.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const hasApiKey = GEMINI_API_KEY.length > 0;

const describeE2E = hasApiKey ? describe : describe.skip;

// ---------------------------------------------------------------------------
// 1. Worker lifecycle: launch -> task assign -> execute -> complete
// ---------------------------------------------------------------------------
describeE2E('e2e: worker lifecycle (launch -> task assign -> execute -> complete)', () => {
  let tempRoot: string;
  let stateStore: TeamStateStore;
  const teamName = 'e2e-lifecycle';

  beforeEach(async () => {
    tempRoot = createTempDir('omg-e2e-lifecycle-');
    stateStore = new TeamStateStore({ rootDir: path.join(tempRoot, '.omg', 'state') });
    await stateStore.ensureTeamScaffold(teamName);
  });

  afterEach(() => {
    removeDir(tempRoot);
  });

  test('full worker lifecycle with real Gemini API call', async () => {
    // Phase 1: Launch — write worker context (hook fires)
    await writeWorkerContext({
      cwd: tempRoot,
      teamName,
      task: 'e2e lifecycle validation',
      workers: 1,
    });

    const context = await readTeamContext(tempRoot);
    expect(context).not.toBeNull();
    expect(context).toContain(teamName);
    expect(context).toContain('e2e lifecycle validation');

    // Phase 2: Task assign — seed a task and claim it via control plane
    const task = await stateStore.writeTask(teamName, {
      id: '1',
      subject: 'Summarize a greeting',
      status: 'pending',
      required: true,
    });
    expect(task.id).toBe('1');
    expect(task.status).toBe('pending');

    const controlPlane = new TaskControlPlane({ stateStore });
    const claim = await controlPlane.claimTask({
      teamName,
      taskId: '1',
      worker: 'worker-1',
    });
    expect(claim.claimToken).toBeTruthy();

    // Transition task to in_progress
    await controlPlane.transitionTaskStatus({
      teamName,
      taskId: '1',
      worker: 'worker-1',
      claimToken: claim.claimToken,
      from: 'pending',
      to: 'in_progress',
    });

    const inProgressTask = await stateStore.readTask(teamName, '1');
    expect(inProgressTask?.status).toBe('in_progress');

    // Write heartbeat signal (simulating worker is alive)
    const heartbeat = buildHeartbeatSignal({
      teamName,
      workerName: 'worker-1',
      alive: true,
      pid: process.pid,
      turnCount: 1,
      currentTaskId: '1',
    });
    await stateStore.writeWorkerHeartbeat(heartbeat);

    const readHeartbeat = await stateStore.readWorkerHeartbeat(teamName, 'worker-1');
    expect(readHeartbeat?.alive).toBe(true);
    expect(readHeartbeat?.currentTaskId).toBe('1');

    // Phase 3: Execute — make a real Gemini API call
    const client = new GeminiApiClient({
      env: { GEMINI_API_KEY },
    });

    const response: GeminiGenerateContentResponse = await client.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Reply with exactly: LIFECYCLE_OK' }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 32,
        temperature: 0,
      },
    });

    expect(response.candidates).toBeDefined();
    expect(Array.isArray(response.candidates)).toBe(true);
    expect(response.candidates!.length).toBeGreaterThanOrEqual(1);

    // Phase 4: Complete — transition task, write done signal
    await controlPlane.transitionTaskStatus({
      teamName,
      taskId: '1',
      worker: 'worker-1',
      claimToken: claim.claimToken,
      from: 'in_progress',
      to: 'completed',
    });

    const completedTask = await stateStore.readTask(teamName, '1');
    expect(completedTask?.status).toBe('completed');

    const doneSignal = buildDoneSignal({
      teamName,
      workerName: 'worker-1',
      status: 'completed',
      summary: 'E2E lifecycle test passed',
      taskId: '1',
    });
    await stateStore.writeWorkerDone(doneSignal);

    const readDone = await stateStore.readWorkerDone(teamName, 'worker-1');
    expect(readDone?.status).toBe('completed');
    expect(readDone?.summary).toBe('E2E lifecycle test passed');

    // Verify audit trail was recorded
    const auditEvents = await stateStore.readTaskAuditEvents(teamName);
    expect(auditEvents.length).toBeGreaterThanOrEqual(2); // claim + at least one transition
    expect(auditEvents.some((e) => e.action === 'claim')).toBe(true);
    expect(auditEvents.some((e) => e.action === 'transition')).toBe(true);
  }, 60_000);

  test('multi-worker task assignment and concurrent completion', async () => {
    // Seed two tasks
    await stateStore.writeTask(teamName, {
      id: '1',
      subject: 'Worker 1 task',
      status: 'pending',
      required: true,
    });
    await stateStore.writeTask(teamName, {
      id: '2',
      subject: 'Worker 2 task',
      status: 'pending',
      required: true,
    });

    const controlPlane = new TaskControlPlane({ stateStore });

    // Claim tasks for two workers
    const claim1 = await controlPlane.claimTask({ teamName, taskId: '1', worker: 'worker-1' });
    const claim2 = await controlPlane.claimTask({ teamName, taskId: '2', worker: 'worker-2' });

    expect(claim1.claimToken).toBeTruthy();
    expect(claim2.claimToken).toBeTruthy();

    // Both workers make API calls concurrently
    const client = new GeminiApiClient({ env: { GEMINI_API_KEY } });

    const [response1, response2] = await Promise.all([
      client.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: 'Reply with: WORKER_1_OK' }] }],
        generationConfig: { maxOutputTokens: 16, temperature: 0 },
      }),
      client.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: 'Reply with: WORKER_2_OK' }] }],
        generationConfig: { maxOutputTokens: 16, temperature: 0 },
      }),
    ]);

    expect(response1.candidates?.length).toBeGreaterThanOrEqual(1);
    expect(response2.candidates?.length).toBeGreaterThanOrEqual(1);

    // Complete both tasks
    await controlPlane.transitionTaskStatus({
      teamName, taskId: '1', worker: 'worker-1',
      claimToken: claim1.claimToken, from: 'pending', to: 'in_progress',
    });
    await controlPlane.transitionTaskStatus({
      teamName, taskId: '1', worker: 'worker-1',
      claimToken: claim1.claimToken, from: 'in_progress', to: 'completed',
    });
    await controlPlane.transitionTaskStatus({
      teamName, taskId: '2', worker: 'worker-2',
      claimToken: claim2.claimToken, from: 'pending', to: 'in_progress',
    });
    await controlPlane.transitionTaskStatus({
      teamName, taskId: '2', worker: 'worker-2',
      claimToken: claim2.claimToken, from: 'in_progress', to: 'completed',
    });

    // Write done signals for both workers
    await stateStore.writeWorkerDone(buildDoneSignal({
      teamName, workerName: 'worker-1', status: 'completed', taskId: '1',
    }));
    await stateStore.writeWorkerDone(buildDoneSignal({
      teamName, workerName: 'worker-2', status: 'completed', taskId: '2',
    }));

    // Verify both tasks completed
    const tasks = await stateStore.listTasks(teamName);
    expect(tasks.every((t) => t.status === 'completed')).toBe(true);

    // Verify both done signals present
    const doneSignals = await stateStore.readAllWorkerDoneSignals(teamName);
    expect(Object.keys(doneSignals).sort()).toEqual(['worker-1', 'worker-2']);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// 2. Skill loading and hook firing
// ---------------------------------------------------------------------------
describeE2E('e2e: skill loading and hook firing with Gemini API', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempDir('omg-e2e-skills-');
  });

  afterEach(() => {
    removeDir(tempRoot);
  });

  test('skill dispatcher loads skills and context writer injects them into GEMINI.md', async () => {
    // Load skills through the dispatcher
    const skills = await listSkills();
    expect(skills.length).toBeGreaterThanOrEqual(5);

    const planSkill = await dispatchSkill('plan', ['test planning task']);
    expect(planSkill).not.toBeNull();
    expect(planSkill?.skill.name).toBe('plan');
    expect(planSkill?.prompt).toBe('test planning task');

    // Write worker context (hook fires) and verify skills are injected
    await writeWorkerContext({
      cwd: tempRoot,
      teamName: 'e2e-skill-team',
      task: 'validate skill injection',
      workers: 1,
    });

    const content = await readTeamContext(tempRoot);
    expect(content).not.toBeNull();
    expect(content).toContain('Available Skills');
    expect(content).toContain('`plan`');
    expect(content).toContain('`team`');
    expect(content).toContain('`review`');
    expect(content).toContain('`verify`');
    expect(content).toContain('`handoff`');

    // Verify env var documentation is present (hook output)
    expect(content).toContain('OMG_WORKER_TASK_ID');
    expect(content).toContain('OMG_WORKER_CLAIM_TOKEN');
    expect(content).toContain('Worker Done Signal Protocol');
  });

  test('Gemini API can process a skill-generated prompt', async () => {
    const planSkill = await dispatchSkill('plan', ['create a minimal test plan']);
    expect(planSkill).not.toBeNull();

    const client = new GeminiApiClient({ env: { GEMINI_API_KEY } });

    // Use the skill prompt as system instruction context for the API call
    const response = await client.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `Given this skill context, reply with exactly: SKILL_LOADED` }],
        },
      ],
      systemInstruction: `You are a worker with skill: ${planSkill!.skill.name}`,
      generationConfig: { maxOutputTokens: 32, temperature: 0 },
    });

    expect(response.candidates).toBeDefined();
    expect(response.candidates!.length).toBeGreaterThanOrEqual(1);
    expect(response.usageMetadata).toBeDefined();
  }, 30_000);

  test('context writer creates .gemini directory structure as hook side-effect', async () => {
    const geminiDir = path.join(tempRoot, '.gemini');
    expect(existsSync(geminiDir)).toBe(false);

    await writeWorkerContext({
      cwd: tempRoot,
      teamName: 'e2e-hook-sideeffect',
      task: 'verify directory creation',
      workers: 1,
    });

    expect(existsSync(geminiDir)).toBe(true);
    expect(existsSync(path.join(geminiDir, 'GEMINI.md'))).toBe(true);

    const stat = await fs.stat(path.join(geminiDir, 'GEMINI.md'));
    expect(stat.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Session recording and artifact creation
// ---------------------------------------------------------------------------
describeE2E('e2e: session recording and artifact creation', () => {
  let tempRoot: string;
  let stateStore: TeamStateStore;
  const teamName = 'e2e-session';

  beforeEach(async () => {
    tempRoot = createTempDir('omg-e2e-session-');
    stateStore = new TeamStateStore({ rootDir: path.join(tempRoot, '.omg', 'state') });
    await stateStore.ensureTeamScaffold(teamName);
  });

  afterEach(() => {
    removeDir(tempRoot);
  });

  test('full session recording: phase transitions, heartbeats, task audit, done signals', async () => {
    // Write initial phase state
    await stateStore.writePhaseState(teamName, {
      teamName,
      runId: 'e2e-run-001',
      currentPhase: 'plan',
      maxFixAttempts: 2,
      currentFixAttempt: 0,
      transitions: [],
      updatedAt: new Date().toISOString(),
    });

    // Record phase transition: plan -> exec
    await stateStore.appendPhaseTransition(teamName, {
      teamName,
      runId: 'e2e-run-001',
      from: 'plan',
      to: 'exec',
      at: new Date().toISOString(),
      reason: 'Prerequisites validated',
    });

    // Seed a task
    await stateStore.writeTask(teamName, {
      id: '1',
      subject: 'E2E session task',
      status: 'pending',
      required: true,
    });

    // Claim task and record audit events
    const controlPlane = new TaskControlPlane({ stateStore });
    const claim = await controlPlane.claimTask({
      teamName,
      taskId: '1',
      worker: 'worker-1',
    });

    // Write heartbeat
    await stateStore.writeWorkerHeartbeat(buildHeartbeatSignal({
      runId: 'e2e-run-001',
      teamName,
      workerName: 'worker-1',
      alive: true,
      pid: process.pid,
      turnCount: 1,
      currentTaskId: '1',
    }));

    // Make a real API call to simulate work
    const client = new GeminiApiClient({ env: { GEMINI_API_KEY } });
    const response = await client.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: 'Reply with: SESSION_OK' }] }],
      generationConfig: { maxOutputTokens: 16, temperature: 0 },
    });
    expect(response.candidates?.length).toBeGreaterThanOrEqual(1);

    // Transition task: pending -> in_progress -> completed
    await controlPlane.transitionTaskStatus({
      teamName, taskId: '1', worker: 'worker-1',
      claimToken: claim.claimToken, from: 'pending', to: 'in_progress',
    });
    await controlPlane.transitionTaskStatus({
      teamName, taskId: '1', worker: 'worker-1',
      claimToken: claim.claimToken, from: 'in_progress', to: 'completed',
    });

    // Write monitor snapshot
    await stateStore.writeMonitorSnapshot(teamName, {
      runId: 'e2e-run-001',
      teamName,
      handleId: 'e2e-handle',
      backend: 'tmux',
      status: 'completed',
      updatedAt: new Date().toISOString(),
      workers: [{ workerId: 'worker-1', status: 'done' }],
      summary: 'E2E session completed successfully',
    });

    // Write done signal
    await stateStore.writeWorkerDone(buildDoneSignal({
      teamName,
      workerName: 'worker-1',
      status: 'completed',
      summary: 'Session test passed',
      taskId: '1',
    }));

    // Record phase transition: exec -> verify -> completed
    await stateStore.appendPhaseTransition(teamName, {
      teamName,
      runId: 'e2e-run-001',
      from: 'exec',
      to: 'verify',
      at: new Date().toISOString(),
      reason: 'Verification attempt 1',
    });
    await stateStore.appendPhaseTransition(teamName, {
      teamName,
      runId: 'e2e-run-001',
      from: 'verify',
      to: 'completed',
      at: new Date().toISOString(),
      reason: 'Verification passed',
    });

    // --- Verify all artifacts were persisted ---

    // Phase state
    const phaseState = await stateStore.readPhaseState(teamName);
    expect(phaseState).not.toBeNull();
    expect(phaseState?.runId).toBe('e2e-run-001');

    // Monitor snapshot
    const snapshot = await stateStore.readMonitorSnapshot(teamName);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.status).toBe('completed');
    expect(snapshot?.summary).toBe('E2E session completed successfully');
    expect(snapshot?.workers).toHaveLength(1);
    expect(snapshot?.workers[0]?.workerId).toBe('worker-1');

    // Task
    const task = await stateStore.readTask(teamName, '1');
    expect(task?.status).toBe('completed');

    // Worker heartbeat
    const heartbeat = await stateStore.readWorkerHeartbeat(teamName, 'worker-1');
    expect(heartbeat?.alive).toBe(true);
    expect(heartbeat?.runId).toBe('e2e-run-001');

    // Worker done signal
    const done = await stateStore.readWorkerDone(teamName, 'worker-1');
    expect(done?.status).toBe('completed');

    // Audit events
    const auditEvents = await stateStore.readTaskAuditEvents(teamName);
    expect(auditEvents.length).toBeGreaterThanOrEqual(3); // claim + 2 transitions

    // Verify filesystem artifacts exist on disk
    const teamDir = stateStore.getTeamDir(teamName);
    expect(existsSync(path.join(teamDir, 'phase.json'))).toBe(true);
    expect(existsSync(path.join(teamDir, 'monitor-snapshot.json'))).toBe(true);
    expect(existsSync(path.join(teamDir, 'events', 'phase-transitions.ndjson'))).toBe(true);
    expect(existsSync(path.join(teamDir, 'events', 'task-lifecycle.ndjson'))).toBe(true);
    expect(existsSync(path.join(teamDir, 'tasks', 'task-1.json'))).toBe(true);
    expect(existsSync(path.join(teamDir, 'workers', 'worker-1', 'heartbeat.json'))).toBe(true);
    expect(existsSync(path.join(teamDir, 'workers', 'worker-1', 'done.json'))).toBe(true);
  }, 60_000);

  test('mailbox messages are recorded as session artifacts', async () => {
    await stateStore.appendMailboxMessage(teamName, 'worker-1', {
      fromWorker: 'worker-2',
      toWorker: 'worker-1',
      body: 'Task dependency resolved, you can proceed.',
    });

    const messages = await stateStore.readMailboxMessages(teamName, 'worker-1');
    expect(messages.length).toBe(1);
    expect(messages[0]?.fromWorker).toBe('worker-2');
    expect(messages[0]?.body).toContain('Task dependency resolved');

    // Verify mailbox file on disk
    const mailboxDir = stateStore.getMailboxDir(teamName);
    expect(existsSync(path.join(mailboxDir, 'worker-1.ndjson'))).toBe(true);
  });

  test('worker status artifacts are persisted across read/write cycle', async () => {
    await stateStore.writeWorkerStatus(teamName, 'worker-1', {
      state: 'in_progress',
      reason: 'Processing task',
      currentTaskId: '1',
      updatedAt: new Date().toISOString(),
    });

    const status = await stateStore.readWorkerStatus(teamName, 'worker-1');
    expect(status?.state).toBe('in_progress');
    expect(status?.reason).toBe('Processing task');

    // Read all statuses
    const allStatuses = await stateStore.readAllWorkerStatuses(teamName);
    expect(allStatuses['worker-1']?.state).toBe('in_progress');
  });
});

// ---------------------------------------------------------------------------
// Guard: skip message when GEMINI_API_KEY is not set
// ---------------------------------------------------------------------------
describe.skipIf(hasApiKey)('e2e: skip guard', () => {
  test('set GEMINI_API_KEY to run Gemini E2E integration tests', () => {
    expect(true).toBe(true);
  });
});
