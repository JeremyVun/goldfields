import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    // .mjs as well as .ts: a couple of suites inspect shipped files on disk,
    // which the project's TypeScript has no node types for and wants none.
    include: ['tests/**/*.test.{ts,mjs}'],
    environment: 'node',
    testTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 78,
        branches: 70,
        functions: 82,
        lines: 80,
      },
    },
  },
});
