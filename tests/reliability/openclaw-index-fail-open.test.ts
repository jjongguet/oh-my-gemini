import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: openclaw fail-open behavior', () => {
  test('wakeOpenClaw stop hook does not throw when command gateway execution fails', async () => {
    const tempRoot = createTempDir('omp-openclaw-stop-fail-open-');
    const configPath = path.join(tempRoot, 'omp_config.openclaw.json');

    const previousOpenClaw = process.env.OMP_OPENCLAW;
    const previousConfig = process.env.OMP_OPENCLAW_CONFIG;

    try {
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            enabled: true,
            gateways: {
              local: {
                type: 'command',
                command: 'nonexistent-openclaw-binary --session {{sessionId}}',
                timeout: 500,
              },
            },
            hooks: {
              stop: {
                enabled: true,
                gateway: 'local',
                instruction: 'stop {{sessionId}}',
              },
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      process.env.OMP_OPENCLAW = '1';
      process.env.OMP_OPENCLAW_CONFIG = configPath;

      const { resetOpenClawConfigCache, wakeOpenClaw } = await import('../../src/openclaw/index.js');
      resetOpenClawConfigCache();

      const result = await wakeOpenClaw('stop', {
        sessionId: 'session-stop-1',
        projectPath: tempRoot,
      });

      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error).toBeTruthy();
    } finally {
      if (previousOpenClaw === undefined) {
        delete process.env.OMP_OPENCLAW;
      } else {
        process.env.OMP_OPENCLAW = previousOpenClaw;
      }

      if (previousConfig === undefined) {
        delete process.env.OMP_OPENCLAW_CONFIG;
      } else {
        process.env.OMP_OPENCLAW_CONFIG = previousConfig;
      }

      removeDir(tempRoot);
    }
  });
});
