import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['metric/test/**/*.test.ts'],
    root: import.meta.dirname + '/..',
    testTimeout: 30_000,
  },
});
