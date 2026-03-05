import { describe, expect, test } from 'vitest';

import { watchRenderLoop } from '../../src/cli/commands/hud.js';

describe('reliability: hud watch loop', () => {
  test('re-renders continuously until aborted', async () => {
    const abortController = new AbortController();
    const renderCalls: number[] = [];

    await watchRenderLoop(
      async () => {
        renderCalls.push(Date.now());
      },
      {
        intervalMs: 1,
        signal: abortController.signal,
        sleepFn: async () => {
          if (renderCalls.length >= 3) {
            abortController.abort();
          }
        },
      },
    );

    expect(renderCalls.length).toBe(3);
  });

  test('continues loop when render throws and onError is provided', async () => {
    const abortController = new AbortController();
    let callCount = 0;
    let onErrorCalls = 0;

    await watchRenderLoop(
      async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('first frame failed');
        }
      },
      {
        intervalMs: 1,
        signal: abortController.signal,
        onError: () => {
          onErrorCalls += 1;
        },
        sleepFn: async () => {
          if (callCount >= 3) {
            abortController.abort();
          }
        },
      },
    );

    expect(callCount).toBe(3);
    expect(onErrorCalls).toBe(1);
  });
});
