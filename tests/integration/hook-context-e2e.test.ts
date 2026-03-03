import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { readTeamContext } from '../../src/hooks/index.js';
import { writeWorkerContext } from '../../src/hooks/context-writer.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

const EXPECTED_SKILLS = ['plan', 'team', 'review', 'verify', 'handoff'];

describe('integration: hook context e2e (write → read round-trip)', () => {
  test('writeWorkerContext creates .gemini/GEMINI.md in cwd', async () => {
    const tempRoot = createTempDir('omg-ctx-create-');

    try {
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'test-team',
        task: 'build the feature',
        workers: 2,
      });

      const geminiPath = path.join(tempRoot, '.gemini', 'GEMINI.md');
      const stat = await fs.stat(geminiPath);
      expect(stat.isFile()).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('written GEMINI.md contains team name and task in content', async () => {
    const tempRoot = createTempDir('omg-ctx-content-');

    try {
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'content-team',
        task: 'write integration tests',
        workers: 3,
      });

      const geminiPath = path.join(tempRoot, '.gemini', 'GEMINI.md');
      const content = await fs.readFile(geminiPath, 'utf8');

      expect(content).toContain('content-team');
      expect(content).toContain('write integration tests');
      expect(content).toContain('Workers: 3');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('written GEMINI.md contains Available Skills section', async () => {
    const tempRoot = createTempDir('omg-ctx-skills-section-');

    try {
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'skills-team',
        task: 'verify skills',
        workers: 1,
      });

      const geminiPath = path.join(tempRoot, '.gemini', 'GEMINI.md');
      const content = await fs.readFile(geminiPath, 'utf8');

      expect(content).toContain('Available Skills');
    } finally {
      removeDir(tempRoot);
    }
  });

  test.each(EXPECTED_SKILLS)(
    'GEMINI.md skill catalog includes skill: %s',
    async (skillName) => {
      const tempRoot = createTempDir(`omg-ctx-skill-${skillName}-`);

      try {
        await writeWorkerContext({
          cwd: tempRoot,
          teamName: 'catalog-team',
          task: 'check skill presence',
          workers: 1,
        });

        const geminiPath = path.join(tempRoot, '.gemini', 'GEMINI.md');
        const content = await fs.readFile(geminiPath, 'utf8');

        expect(content).toContain(`\`${skillName}\``);
      } finally {
        removeDir(tempRoot);
      }
    },
  );

  test('GEMINI.md documents OMG_WORKER_TASK_ID and OMG_WORKER_CLAIM_TOKEN env vars', async () => {
    const tempRoot = createTempDir('omg-ctx-envvars-');

    try {
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'env-team',
        task: 'verify env var docs',
        workers: 1,
      });

      const geminiPath = path.join(tempRoot, '.gemini', 'GEMINI.md');
      const content = await fs.readFile(geminiPath, 'utf8');

      expect(content).toContain('OMG_WORKER_TASK_ID');
      expect(content).toContain('OMG_WORKER_CLAIM_TOKEN');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readTeamContext returns file content after writeWorkerContext', async () => {
    const tempRoot = createTempDir('omg-ctx-roundtrip-');

    try {
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'roundtrip-team',
        task: 'roundtrip check',
        workers: 1,
      });

      const content = await readTeamContext(tempRoot);

      expect(content).not.toBeNull();
      expect(content).toContain('roundtrip-team');
      expect(content).toContain('roundtrip check');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('readTeamContext returns null when GEMINI.md does not exist', async () => {
    const tempRoot = createTempDir('omg-ctx-missing-');

    try {
      const content = await readTeamContext(tempRoot);
      expect(content).toBeNull();
    } finally {
      removeDir(tempRoot);
    }
  });

  test('writeWorkerContext uses custom state root from env option', async () => {
    const tempRoot = createTempDir('omg-ctx-stateroot-');

    try {
      const customStateRoot = '/custom/state/root';
      await writeWorkerContext({
        cwd: tempRoot,
        teamName: 'state-team',
        task: 'custom state root test',
        workers: 1,
        env: { OMG_TEAM_STATE_ROOT: customStateRoot },
      });

      const geminiPath = path.join(tempRoot, '.gemini', 'GEMINI.md');
      const content = await fs.readFile(geminiPath, 'utf8');

      expect(content).toContain(customStateRoot);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('writeWorkerContext throws an error with file path when write fails', async () => {
    const tempRoot = createTempDir('omg-ctx-error-');

    try {
      // Use a path where the parent is a file, not a directory — write must fail
      const fakeCwd = path.join(tempRoot, 'not-a-dir.txt');
      // Create a file at that path so mkdir fails
      await fs.writeFile(fakeCwd, 'blocker', 'utf8');

      await expect(
        writeWorkerContext({
          cwd: fakeCwd,
          teamName: 'error-team',
          task: 'error path',
          workers: 1,
        }),
      ).rejects.toThrow(/GEMINI\.md|Failed to write|ENOTDIR|not a directory/);
    } finally {
      removeDir(tempRoot);
    }
  });
});
