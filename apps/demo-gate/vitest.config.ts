import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// ★ THE TIMEOUT FLOOR IS DECLARED HERE, because the import it used to have never resolved in THIS repository.
// Until pk24/d3 this file read `import { TIMEOUTS } from '../../vitest.shared'` — a file of the Forge MONOREPO.
// This app lives in `forge-demo`, where `../../vitest.shared` is nothing at all, and the cost was total rather
// than cosmetic: measured 2026-09-08, vitest could not even load the config —
//
//     apps/demo-gate/vitest.config.ts:3  import { TIMEOUTS } from '../../vitest.shared'  Module not found.
//
// so the three suites under this directory collected zero tests, in a repository where nothing ran them
// anyway. The numbers below are the monorepo's, copied WITH their derivation rather than with a pointer: 120 s
// is `worst honest file 12.7 s × worst measured contention 6.1x ≈ 77 s`, rounded up (vitest.shared.ts in the
// Forge tree carries the full measurement); the hook ceiling stays at 20 s because no hook has ever died.
// A timeout exists to catch a HANG, not to police speed.
const TIMEOUTS = { testTimeout: 120_000, hookTimeout: 20_000 } as const;

export default defineConfig({
  plugins: [react()],
  test: {
    ...TIMEOUTS,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    include: ['**/*.test.{ts,tsx}'],
  },
});
