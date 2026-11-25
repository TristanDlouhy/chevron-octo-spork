import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['acceptance/**/*.test.ts'],
    root: import.meta.dirname + '/..',
    testTimeout: 10_000,
    fileParallelism: false,
  },
});
