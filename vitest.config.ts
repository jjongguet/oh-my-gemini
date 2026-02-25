import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: 'default',
    hookTimeout: 60_000,
    testTimeout: 120_000,
    globals: true
  }
});
