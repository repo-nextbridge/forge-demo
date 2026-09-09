import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The timeout floor, declared here rather than imported: `../../vitest.shared` is a file of the Forge
// MONOREPO and this app lives in `forge-demo`, where that path is nothing at all. `demo-gate` carried exactly
// that import until pk24/D3 and its three suites collected ZERO tests because the config could not load.
// The numbers are the monorepo's, copied WITH their derivation: 120 s is `worst honest file 12.7 s × worst
// measured contention 6.1x ≈ 77 s`, rounded up; the hook ceiling stays at 20 s because no hook has ever died.
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
