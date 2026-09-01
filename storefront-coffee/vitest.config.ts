// The storefront's vitest config OUTSIDE the Forge monorepo — laid over the packed copy by
// scripts/publishing/pack-surface.ts, replacing `apps/storefront/vitest.config.ts` whole.
//
// It is a separate file rather than a rewrite of ours for one reason: substituting a file is something a
// reviewer can read in a diff, while a regex over someone else's config is a transformation nobody sees. Two
// things genuinely differ out here, and both are the kind of thing that only shows up on a customer's machine:
//
//   1. `TIMEOUTS` is INLINE. In the monorepo it comes from `../../vitest.shared`, a path a copy will never
//      have. The values are the workspace floor, and the reason they are not vitest's 5s default is written
//      there: a timeout catches a HANG, not slowness — under load a 175ms test can take 5.9s and a tight
//      ceiling turns that into a flake.
//      ⚠️ THEY MOVE WHEN THE FLOOR MOVES, and they just did: testTimeout went 20s → 120s on 2026-08-22, from
//      the derivation written in vitest.shared.ts (worst honest file 12.7s x worst measured contention 6.1x =
//      77s; 120s is ~1.6x that). Copying the floor rather than picking a number for out here is deliberate:
//      this config runs on a machine we have never seen, so a ceiling tuned to OUR runner is the only one we
//      can defend, and erring generous costs a customer nothing but a slower hang report. NOTHING MECHANICAL
//      TIES THESE TWO FILES — said out loud because it is exactly the drift this class of comment breeds: if
//      you change the floor, change this, or the sentence above becomes false in silence.
//   2. `server.deps.inline`. Inside the monorepo pnpm links the block packages, so their real path is outside
//      node_modules and vitest treats them as source. Installed from a tarball their real path IS
//      node_modules, which vitest externalizes — and an externalized `.tsx` is a syntax error, not a module.
//      This is the same class of surprise the `transpilePackages` line in next.config.mjs exists for, one
//      layer down: what changes is not the code, it is where the code lives.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The React plugin transforms JSX (automatic runtime), overriding the app tsconfig's `jsx: preserve`
  // (required by Next) for the test pipeline.
  plugins: [react()],
  resolve: {
    // Mirror tsconfig's `@/*` -> `src/*` for the test resolver.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: 20_000,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: { deps: { inline: [/@forgecommerce\//] } },
    // Process CSS modules so component styles inject into the test DOM and class names stay readable —
    // lets a test render the REAL component and read the style binding it actually consumes.
    css: { modules: { classNameStrategy: 'non-scoped' } },
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
