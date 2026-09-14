import { defineConfig } from 'vitest/config';

// Offline evaluation against research corpora (`npm run eval:corpus`); see scripts/corpus/evaluate.eval.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/corpus/**/*.eval.ts'],
    testTimeout: 4 * 60 * 60 * 1000,
  },
});
