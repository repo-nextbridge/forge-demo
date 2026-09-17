// The totem's vitest config. Same shape and the same two out-of-monorepo adjustments as the coffee vitrine's
// (`storefront-coffee/vitest.config.ts`), for the same measured reasons written there:
//
//   1. TIMEOUTS ARE INLINE. The workspace floor lives in the monorepo's `vitest.shared.ts`, a path a copy in
//      this repository will never have. The numbers are copied rather than invented: a ceiling tuned to our
//      runner is the only one we could defend on a machine we have never seen, and erring generous costs
//      nothing but a slower hang report. Nothing mechanical ties this to the floor — said out loud.
//   2. `server.deps.inline`. Installed from a tarball, `@forgeco/*` really lives in node_modules, which
//      vitest externalizes — and an externalized `.tsx` is a syntax error, not a module. Same class of
//      surprise as `transpilePackages` next door, one layer down. `@forge/ext-demo-gate` is on the list for
//      exactly the same reason: it travels as source.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The demo gate resolves through a symlink in node_modules; pointing vitest at the real directory
      // keeps its .tsx on the transform side of the fence (see the note on server.deps.inline below).
      '@forge/ext-demo-gate': fileURLToPath(new URL('../apps/demo-gate', import.meta.url)),
    },
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: 20_000,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: { deps: { inline: [/@forgeco\//, /@forge\//] } },
    css: { modules: { classNameStrategy: 'non-scoped' } },
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
