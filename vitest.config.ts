import { defineConfig } from 'vitest/config';

/**
 * The pure-logic test runner (decision 9: the carried-over v1 engine tests are the
 * safety net for the port). Scoped to pure TypeScript only — no React Native
 * transform — so it stays fast and never tries to bundle native modules. RN
 * component tests are out of scope for v2.0.
 *
 * Phase 2 fills `src/logic/` and `src/types/` with the ~79 engine cases translated
 * from the v1 pytest suite.
 */
export default defineConfig({
  test: {
    include: ['src/logic/**/*.{test,spec}.ts', 'src/types/**/*.{test,spec}.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
